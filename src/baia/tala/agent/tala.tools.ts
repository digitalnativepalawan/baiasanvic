/**
 * TALA tool registry (SERVER-ONLY).
 *
 * Real tools over real data — no mocks. Two surfaces:
 *
 *   GUEST  — read-only lookups (knowledge, rooms, experiences, site info) plus
 *            exactly one write: create_booking_lead. Every string that could
 *            reach a guest is passed through the monetary guardrails
 *            (price fields dropped, stripMonetary on text) BEFORE the model
 *            sees it. The reply-side sanitizer remains the second layer.
 *
 *   ADMIN  — everything above plus write access: site content (site_state),
 *            knowledge base, booking-inquiry triage, and the operations
 *            tables (tala_rooms / tala_tasks). Admin tools hard-assert the
 *            surface: the loop only exposes them after the admin passkey has
 *            been verified server-side, and each executor re-checks so the
 *            registry is safe to import from any path.
 *
 * Every execution is recorded in tala_action_log (fail-safe) by
 * executeTool(). Tool results are size-capped so a chatty tool can't blow up
 * the model context.
 */
import { ROOMS, ATTRACTIONS, ACTIVITIES } from "../../data";
import type { RoomTier, Activity, Attraction } from "../../types";
import { stripMonetary } from "../../concierge.knowledge";
import { retrieveRelevant, chunksToText } from "../../concierge.retrieve";
import { loadDbKnowledgeChunks } from "../../concierge.knowledge.server";
import { handleCreateGuestLead, deriveGuestLeadIdempotencyKey } from "../../ops/guest-lead.server";
import { logTalaAction, summarizeForLog, type TalaSurface } from "./tala.actions";

// ---------------------------------------------------------------------------
// Context + result shapes
// ---------------------------------------------------------------------------

export interface ToolContext {
  surface: TalaSurface;
  sessionId: string;
  /** Owner's "extra knowledge" box from the concierge config. */
  customKnowledge?: string;
  /** Set by the server function after verifying ADMIN_PASSKEY. */
  adminVerified?: boolean;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
  surfaces: TalaSurface[];
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

const MAX_RESULT_CHARS = 6_000;

function ok(data: unknown): ToolResult {
  return { ok: true, data };
}
function fail(error: string): ToolResult {
  return { ok: false, error };
}

/** Guard: admin-only tool executor prologue. */
function assertAdmin(ctx: ToolContext): ToolResult | null {
  if (ctx.surface !== "admin" || !ctx.adminVerified) {
    return fail("This tool requires the admin surface with a verified passkey.");
  }
  return null;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Recursively drop price-like keys and strip monetary tokens from strings so
 * nothing monetary ever reaches the model on the guest surface. (The admin
 * surface intentionally sees real numbers — the owner's own data.)
 */
export function guestSafe<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => guestSafe(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/price|cost|rate|total|fee|deposit/i.test(k)) continue;
      out[k] = guestSafe(v);
    }
    return out as unknown as T;
  }
  if (typeof value === "string") return stripMonetary(value) as unknown as T;
  return value;
}

function capResult<T>(v: T): T {
  const s = JSON.stringify(v);
  if (s && s.length > MAX_RESULT_CHARS) {
    return { truncated: true, preview: s.slice(0, MAX_RESULT_CHARS) } as unknown as T;
  }
  return v;
}

// ---------------------------------------------------------------------------
// Live site data helpers (site_state first, static data as fallback)
// ---------------------------------------------------------------------------

interface SiteStateShape {
  hero?: Record<string, unknown>;
  philosophy?: Record<string, unknown>;
  islandIntro?: Record<string, unknown>;
  logo?: Record<string, unknown>;
  header?: Record<string, unknown>;
  footer?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  galleryItems?: unknown[];
  rooms?: RoomTier[];
  activities?: Activity[];
  testimonials?: unknown[];
  investors?: Record<string, unknown>;
}

async function loadSiteState(): Promise<SiteStateShape | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("site_state")
      .select("data")
      .eq("key", "default")
      .maybeSingle();
    if (error) {
      console.warn(`[TALA] site_state read failed (${error.message}); using static data`);
      return null;
    }
    return (data?.data as SiteStateShape) ?? null;
  } catch {
    return null;
  }
}

async function liveRooms(): Promise<RoomTier[]> {
  const state = await loadSiteState();
  const rooms = state?.rooms;
  return Array.isArray(rooms) && rooms.length > 0 ? rooms : ROOMS;
}

async function liveExperiences(): Promise<{ activities: Activity[]; attractions: Attraction[] }> {
  const state = await loadSiteState();
  const activities =
    Array.isArray(state?.activities) && state.activities.length > 0
      ? (state!.activities as Activity[])
      : ACTIVITIES;
  return { activities, attractions: ATTRACTIONS };
}

// ---------------------------------------------------------------------------
// GUEST TOOLS
// ---------------------------------------------------------------------------

const searchKnowledge: ToolDef = {
  name: "search_knowledge",
  description:
    "Search BAIA's knowledge base (rooms, dining, transport, policies, FAQ, owner-added topics) for passages relevant to a question. Use before answering factual questions about the resort.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The question or topic to search for." },
    },
    required: ["query"],
  },
  surfaces: ["guest", "admin"],
  execute: async (args, ctx) => {
    const query = str(args.query).trim();
    if (!query) return fail("query is required");
    const dbChunks = await loadDbKnowledgeChunks().catch(() => []);
    const { chunks } = retrieveRelevant(query, ctx.customKnowledge ?? "", dbChunks);
    if (chunks.length === 0)
      return ok({
        found: false,
        note: "No knowledge matched; answer from HARD RULES/contact path.",
      });
    return ok(capResult({ found: true, knowledge: chunksToText(chunks) }));
  },
};

const listRooms: ToolDef = {
  name: "list_rooms",
  description:
    "List BAIA's room types with capacity, size, amenities, and property inventory count. Inventory is NOT current availability. Never quote prices.",
  parameters: { type: "object", properties: {} },
  surfaces: ["guest", "admin"],
  execute: async (_args, ctx) => {
    const rooms = await liveRooms();
    const payload = guestSafe(
      rooms.map((r) => ({
        name: r.name,
        size: r.size,
        capacity: r.capacity,
        amenities: r.amenities,
        description: r.description,
        propertyInventory: r.availabilityCount ?? 0,
        note: "Property inventory only — current availability requires confirmation.",
      })),
    );
    if (ctx.surface === "guest") return ok(capResult(payload));
    return ok(capResult(rooms.map((r) => ({ ...r, imageUrl: undefined, images: undefined }))));
  },
};

const listExperiences: ToolDef = {
  name: "list_experiences",
  description:
    "List bookable experiences/activities and nearby attractions with duration, difficulty, and distance from the resort. Never quote prices.",
  parameters: { type: "object", properties: {} },
  surfaces: ["guest", "admin"],
  execute: async () => {
    const { activities, attractions } = await liveExperiences();
    return ok(
      capResult(
        guestSafe({
          experiences: activities.map((a) => ({
            title: a.title,
            category: a.category,
            duration: a.duration,
            difficulty: a.difficulty,
            description: a.description,
          })),
          nearby: attractions.map((at) => ({
            name: at.name,
            category: at.category,
            distance: at.distanceFromResort,
            description: at.description,
            tip: at.tips,
          })),
        }),
      ),
    );
  },
};

const getSiteInfo: ToolDef = {
  name: "get_site_info",
  description:
    "Read the live public site content: hero, philosophy, islandIntro, logo, header, or footer. Use for contact details, taglines, and current copy.",
  parameters: {
    type: "object",
    properties: {
      section: {
        type: "string",
        enum: ["hero", "philosophy", "islandIntro", "logo", "header", "footer"],
        description: "Which site section to read.",
      },
    },
    required: ["section"],
  },
  surfaces: ["guest", "admin"],
  execute: async (args) => {
    const section = str(args.section);
    const allowed = ["hero", "philosophy", "islandIntro", "logo", "header", "footer"];
    if (!allowed.includes(section)) return fail(`section must be one of: ${allowed.join(", ")}`);
    const state = (await loadSiteState()) ?? {};
    const content = (state as Record<string, unknown>)[section];
    if (!content) return fail(`No live content stored for "${section}".`);
    return ok(capResult({ section, content: guestSafe(content) }));
  },
};

const createBookingLead: ToolDef = {
  name: "create_booking_lead",
  description:
    "Save a qualified booking inquiry to the resort's lead pipeline. Call this once you have at least an email plus dates or room preference. Idempotent: the same inquiry never duplicates.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Guest name if known." },
      email: { type: "string", description: "Guest email (required)." },
      phone: { type: "string" },
      check_in: { type: "string", description: "ISO date, e.g. 2026-11-14" },
      check_out: { type: "string", description: "ISO date, e.g. 2026-11-18" },
      adults: { type: "number" },
      children: { type: "number" },
      room_preference: { type: "string" },
      notes: { type: "string", description: "Anything else the guest mentioned." },
    },
    required: ["email"],
  },
  surfaces: ["guest", "admin"],
  execute: async (args, ctx) => {
    const email = str(args.email).trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail("A valid email is required to save a lead.");
    const stay: Record<string, unknown> = {};
    if (args.check_in) stay.check_in = str(args.check_in);
    if (args.check_out) stay.check_out = str(args.check_out);
    const adults = num(args.adults);
    if (adults !== undefined) stay.adults = adults;
    const children = num(args.children);
    if (children !== undefined) stay.children = children;
    if (args.room_preference) stay.room_preference = str(args.room_preference);

    const canonical = JSON.stringify({ email, ...stay, notes: str(args.notes ?? "") });
    const idem = deriveGuestLeadIdempotencyKey(ctx.sessionId, canonical);
    try {
      const evidence = await handleCreateGuestLead({
        resort_id: "baia-san-vicente",
        idempotency_key: idem,
        channel: ctx.surface === "admin" ? "admin-chat" : "website-chat",
        guest: {
          name: args.name ? str(args.name) : undefined,
          email,
          phone: args.phone ? str(args.phone) : undefined,
        },
        stay,
        notes: args.notes ? str(args.notes) : undefined,
      });
      return ok({
        saved: true,
        newLead: evidence.created,
        leadId: evidence.lead_id,
        persistence: evidence.persistence,
        note: "Lead captured. The team confirms rates and availability by email — never quote prices.",
      });
    } catch (err) {
      return fail(`Lead capture failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

// ---------------------------------------------------------------------------
// ADMIN TOOLS (write access — surface-checked)
// ---------------------------------------------------------------------------

const BOOKING_STATUSES = ["pending", "confirmed", "declined", "archived"];

const getDailyPulse: ToolDef = {
  name: "get_daily_pulse",
  description:
    "One-call operations snapshot: booking inquiries by status, knowledge base size, room statuses, open housekeeping tasks, and TALA activity in the last 24h.",
  parameters: { type: "object", properties: {} },
  surfaces: ["admin"],
  execute: async (_args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    const pulse: Record<string, unknown> = { generatedAt: new Date().toISOString() };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [inquiriesRes, knowledgeRes, roomsRes, tasksRes, actionsRes] = await Promise.all([
        supabaseAdmin.from("booking_inquiries").select("status").limit(500),
        supabaseAdmin.from("concierge_knowledge").select("id, enabled").limit(500),
        supabaseAdmin.from("tala_rooms").select("name, status").limit(100),
        supabaseAdmin.from("tala_tasks").select("status").limit(200),
        supabaseAdmin.from("tala_action_log").select("id, created_at").limit(1000),
      ]);
      const byStatus: Record<string, number> = {};
      for (const row of (inquiriesRes.data ?? []) as Array<{ status: string }>) {
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      }
      pulse.inquiries = { byStatus, total: (inquiriesRes.data ?? []).length };
      pulse.knowledgeEntries = (knowledgeRes.data ?? []).filter((r) => r.enabled).length;
      if (!roomsRes.error) {
        pulse.rooms = roomsRes.data ?? [];
      } else {
        pulse.roomsNote =
          "tala_rooms table not available (apply supabase/manual_sql/004_tala_agent.sql).";
      }
      if (!tasksRes.error) {
        const tasks = tasksRes.data as Array<{ status: string }>;
        pulse.openTasks = tasks.filter((t) => t.status !== "completed").length;
      }
      if (!actionsRes.error) {
        const dayAgo = Date.now() - 24 * 3600 * 1000;
        pulse.talaActions24h = (actionsRes.data as Array<{ created_at: string }>).filter(
          (a) => new Date(a.created_at).getTime() > dayAgo,
        ).length;
      }
      pulse.databaseReachable = true;
    } catch (err) {
      pulse.databaseReachable = false;
      pulse.databaseError = err instanceof Error ? err.message : String(err);
    }
    return ok(capResult(pulse));
  },
};

const listBookingInquiries: ToolDef = {
  name: "list_booking_inquiries",
  description:
    "List recent booking inquiries with dates, guest contact, room, nights, total, and status.",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: BOOKING_STATUSES },
      limit: { type: "number", description: "Max rows (default 10, max 50)." },
    },
  },
  surfaces: ["admin"],
  execute: async (args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    const limit = Math.min(Math.max(num(args.limit) ?? 10, 1), 50);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let q = supabaseAdmin
        .from("booking_inquiries")
        .select(
          "reference, check_in, check_out, guest_name, guest_email, guests_count, room_tier_name, total_nights, total_price, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.status) q = q.eq("status", str(args.status));
      const { data, error } = await q;
      if (error) return fail(`Supabase: ${error.message}`);
      return ok(capResult({ count: (data ?? []).length, inquiries: data ?? [] }));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

const updateBookingInquiryStatus: ToolDef = {
  name: "update_booking_inquiry_status",
  description:
    "Move a booking inquiry through the pipeline. Statuses: pending, confirmed, declined, archived. Identify the inquiry by its BAIA-XXXXXX reference.",
  parameters: {
    type: "object",
    properties: {
      reference: { type: "string", description: "BAIA-XXXXXX reference of the inquiry." },
      status: { type: "string", enum: BOOKING_STATUSES },
    },
    required: ["reference", "status"],
  },
  surfaces: ["admin"],
  execute: async (args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    const reference = str(args.reference).trim();
    const status = str(args.status);
    if (!reference || !BOOKING_STATUSES.includes(status)) {
      return fail(`reference and a valid status (${BOOKING_STATUSES.join(", ")}) are required.`);
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("booking_inquiries")
        .update({ status })
        .eq("reference", reference)
        .select("reference, guest_name, status")
        .single();
      if (error) return fail(`Supabase: ${error.message}`);
      return ok({ updated: true, inquiry: data });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

const listKnowledgeEntries: ToolDef = {
  name: "list_knowledge_entries",
  description:
    "List the concierge knowledge base entries (topic, label, enabled, tags) that TALA answers from.",
  parameters: { type: "object", properties: {} },
  surfaces: ["admin"],
  execute: async (_args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("concierge_knowledge")
        .select("id, topic, label, tags, enabled, sort_order")
        .order("sort_order", { ascending: true })
        .limit(200);
      if (error) return fail(`Supabase: ${error.message}`);
      return ok(capResult({ count: (data ?? []).length, entries: data ?? [] }));
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

const upsertKnowledgeEntry: ToolDef = {
  name: "upsert_knowledge_entry",
  description:
    "Create or update a knowledge base entry TALA uses to answer guests. Provide id to update an existing entry, or topic+label+body to create. Never include prices in the body — TALA never quotes them.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "UUID of an existing entry to update." },
      topic: { type: "string" },
      label: { type: "string" },
      body: { type: "string", description: "The knowledge text guests' answers draw from." },
      tags: { type: "array", items: { type: "string" } },
      enabled: { type: "boolean" },
    },
    required: ["body"],
  },
  surfaces: ["admin"],
  execute: async (args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    const body = stripMonetary(str(args.body).trim());
    if (!body) return fail("body is required");
    const patch: Partial<{
      body: string;
      topic: string;
      label: string;
      tags: string[];
      enabled: boolean;
    }> = { body };
    if (args.topic !== undefined) patch.topic = str(args.topic) || "general";
    if (args.label !== undefined) patch.label = str(args.label);
    if (Array.isArray(args.tags)) patch.tags = args.tags.map((t) => String(t));
    if (typeof args.enabled === "boolean") patch.enabled = args.enabled;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (args.id) {
        const { data, error } = await supabaseAdmin
          .from("concierge_knowledge")
          .update(patch)
          .eq("id", str(args.id))
          .select("id, topic, label, enabled")
          .single();
        if (error) return fail(`Supabase: ${error.message}`);
        return ok({ updated: true, entry: data });
      }
      const topic = patch.topic ?? "general";
      const label = patch.label ?? topic;
      const { data, error } = await supabaseAdmin
        .from("concierge_knowledge")
        .insert({ ...patch, topic, label, body })
        .select("id, topic, label, enabled")
        .single();
      if (error) return fail(`Supabase: ${error.message}`);
      return ok({ created: true, entry: data });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

const SITE_TOP_LEVEL = [
  "hero",
  "philosophy",
  "islandIntro",
  "logo",
  "header",
  "footer",
  "theme",
  "galleryItems",
  "rooms",
  "activities",
  "testimonials",
  "investors",
];

/** Set a dot-path value inside a nested plain object (no prototype pollution). */
function setAtPath(obj: Record<string, unknown>, path: string[], value: unknown): string | null {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    const next = cur[k];
    if (next === undefined || next === null || typeof next !== "object" || Array.isArray(next)) {
      return `Path "${path.join(".")}" leaves known structure at "${k}". Ask the owner exactly which field to change.`;
    }
    cur = next as Record<string, unknown>;
  }
  cur[path[path.length - 1]] = value;
  return null;
}

function readAtPath(obj: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

const updateSiteContent: ToolDef = {
  name: "update_site_content",
  description:
    'Edit the live public website content. Provide a dot path (e.g. "hero.title", "footer.email", "philosophy.text") and the new value. Reads current value first, writes the merged state, and confirms what changed.',
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: 'Dot path, e.g. "hero.title".' },
      value: {
        type: ["string", "number", "boolean", "object", "array"],
        description: "The new value for that field.",
      },
    },
    required: ["path", "value"],
  },
  surfaces: ["admin"],
  execute: async (args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    const path = str(args.path).trim().replace(/^\./, "").replace(/\.$/, "");
    const parts = path.split(".").filter(Boolean);
    if (parts.length === 0) return fail("path is required");
    if (!SITE_TOP_LEVEL.includes(parts[0])) {
      return fail(`Top-level section must be one of: ${SITE_TOP_LEVEL.join(", ")}`);
    }
    if (parts.length > 4) return fail("Path too deep — target a specific field.");
    const valueJson = JSON.stringify(args.value ?? null);
    if (valueJson.length > 20_000) return fail("Value too large (20 KB max) — split the edit.");
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("site_state")
        .select("data")
        .eq("key", "default")
        .maybeSingle();
      if (error) return fail(`Supabase read: ${error.message}`);
      const state = (data?.data as Record<string, unknown>) ?? {};
      const before = readAtPath(state, parts);
      const mergeErr = setAtPath(state, parts, args.value);
      if (mergeErr) return fail(mergeErr);
      const { error: upErr } = await supabaseAdmin
        .from("site_state")
        .update({ data: state as never })
        .eq("key", "default");
      if (upErr) return fail(`Supabase write: ${upErr.message}`);
      return ok({
        updated: true,
        path,
        before: before === undefined ? null : before,
        after: args.value,
        note: "Saved to site_state. The public site picks it up on next load/refresh.",
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

const ROOM_STATUSES = ["available", "occupied", "maintenance", "cleaning"];

const listTalaRooms: ToolDef = {
  name: "list_tala_rooms",
  description:
    "List physical rooms from the operations board with their live status (available/occupied/maintenance/cleaning).",
  parameters: { type: "object", properties: {} },
  surfaces: ["admin"],
  execute: async (_args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("tala_rooms")
        .select("name, type, status, capacity")
        .order("name")
        .limit(100);
      if (error) {
        return fail(
          `tala_rooms unavailable (${error.message}). Apply supabase/manual_sql/004_tala_agent.sql first.`,
        );
      }
      return ok({ count: (data ?? []).length, rooms: data ?? [] });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

const updateTalaRoomStatus: ToolDef = {
  name: "update_tala_room_status",
  description:
    "Update a room's status on the operations board (available, occupied, maintenance, cleaning).",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: 'Room name, e.g. "Palma Suite".' },
      status: { type: "string", enum: ROOM_STATUSES },
    },
    required: ["name", "status"],
  },
  surfaces: ["admin"],
  execute: async (args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    const name = str(args.name).trim();
    const status = str(args.status);
    if (!name || !ROOM_STATUSES.includes(status)) {
      return fail(`name and a valid status (${ROOM_STATUSES.join(", ")}) are required.`);
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("tala_rooms")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("name", name)
        .select("name, status")
        .single();
      if (error) return fail(`Supabase: ${error.message}`);
      return ok({ updated: true, room: data });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

const TASK_TYPES = ["cleaning", "maintenance", "restock", "inspection", "other"];
const TASK_PRIORITIES = ["low", "normal", "high", "urgent"];

const createHousekeepingTask: ToolDef = {
  name: "create_housekeeping_task",
  description:
    "Create a housekeeping/operations task on the task board (cleaning, maintenance, restock, inspection, other).",
  parameters: {
    type: "object",
    properties: {
      room: { type: "string", description: 'Room name or area, e.g. "Playa 1" or "Common Area".' },
      task_type: { type: "string", enum: TASK_TYPES },
      priority: { type: "string", enum: TASK_PRIORITIES },
      notes: { type: "string" },
    },
    required: ["room", "task_type"],
  },
  surfaces: ["admin"],
  execute: async (args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    const room = str(args.room).trim();
    const task_type = str(args.task_type);
    if (!room || !TASK_TYPES.includes(task_type))
      return fail("room and a valid task_type are required.");
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("tala_tasks")
        .insert({
          room,
          task_type,
          priority: TASK_PRIORITIES.includes(str(args.priority)) ? str(args.priority) : "normal",
          notes: args.notes ? str(args.notes) : null,
        })
        .select("id, room, task_type, priority, status")
        .single();
      if (error) {
        return fail(
          `tala_tasks unavailable (${error.message}). Apply supabase/manual_sql/004_tala_agent.sql first.`,
        );
      }
      return ok({ created: true, task: data });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

const listHousekeepingTasks: ToolDef = {
  name: "list_housekeeping_tasks",
  description:
    "List tasks on the operations board, optionally filtered by status (pending, in_progress, completed).",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["pending", "in_progress", "completed"] },
      limit: { type: "number" },
    },
  },
  surfaces: ["admin"],
  execute: async (args, ctx) => {
    const denied = assertAdmin(ctx);
    if (denied) return denied;
    const limit = Math.min(Math.max(num(args.limit) ?? 20, 1), 100);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let q = supabaseAdmin
        .from("tala_tasks")
        .select("id, room, task_type, status, priority, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.status) q = q.eq("status", str(args.status));
      const { data, error } = await q;
      if (error) return fail(`tala_tasks unavailable (${error.message}).`);
      return ok({ count: (data ?? []).length, tasks: data ?? [] });
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ALL_TOOLS: ToolDef[] = [
  // guest + admin
  searchKnowledge,
  listRooms,
  listExperiences,
  getSiteInfo,
  createBookingLead,
  // admin only
  getDailyPulse,
  listBookingInquiries,
  updateBookingInquiryStatus,
  listKnowledgeEntries,
  upsertKnowledgeEntry,
  updateSiteContent,
  listTalaRooms,
  updateTalaRoomStatus,
  createHousekeepingTask,
  listHousekeepingTasks,
];

export function getToolsForSurface(surface: TalaSurface): ToolDef[] {
  return ALL_TOOLS.filter((t) => t.surfaces.includes(surface));
}

export function listToolNames(surface: TalaSurface): string[] {
  return getToolsForSurface(surface).map((t) => t.name);
}

/** Convert registry entries to the OpenAI/Ollama tool schema format. */
export function toToolSchemas(defs: ToolDef[]) {
  return defs.map((d) => ({
    type: "function" as const,
    function: { name: d.name, description: d.description, parameters: d.parameters },
  }));
}

/**
 * Execute one tool by name for a context. Single choke point for:
 *   - surface/permission checks (unknown tool or wrong surface → error)
 *   - argument JSON parsing (model output is trusted nowhere)
 *   - the action-log evidence trail (every call, success or error)
 */
export async function executeTool(
  name: string,
  rawArgs: string,
  ctx: ToolContext,
): Promise<{ result: ToolResult; def?: ToolDef }> {
  const def = ALL_TOOLS.find((t) => t.name === name);
  const started = Date.now();

  if (!def) {
    await logTalaAction({
      sessionId: ctx.sessionId,
      surface: ctx.surface,
      tool: name,
      status: "error",
      args: {},
      resultSummary: "Unknown tool",
      durationMs: 0,
    });
    return { result: fail(`Unknown tool "${name}".`) };
  }
  if (!def.surfaces.includes(ctx.surface)) {
    await logTalaAction({
      sessionId: ctx.sessionId,
      surface: ctx.surface,
      tool: name,
      status: "error",
      args: {},
      resultSummary: `Not allowed on ${ctx.surface} surface`,
      durationMs: 0,
    });
    return { result: fail(`Tool "${name}" is not available on the ${ctx.surface} surface.`) };
  }

  let args: Record<string, unknown> = {};
  try {
    args = rawArgs && rawArgs.trim() ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      throw new Error("arguments must be a JSON object");
    }
  } catch {
    const result = fail(`Invalid JSON arguments for "${name}".`);
    await logTalaAction({
      sessionId: ctx.sessionId,
      surface: ctx.surface,
      tool: name,
      status: "error",
      args: { raw: String(rawArgs).slice(0, 200) },
      resultSummary: result.error,
      durationMs: Date.now() - started,
    });
    return { result, def };
  }

  let result: ToolResult;
  try {
    result = await def.execute(args, ctx);
  } catch (err) {
    result = fail(err instanceof Error ? err.message : String(err));
  }

  await logTalaAction({
    sessionId: ctx.sessionId,
    surface: ctx.surface,
    tool: name,
    status: result.ok ? "success" : "error",
    args: Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 120) : v]),
    ),
    resultSummary: result.ok ? summarizeForLog(result.data) : result.error,
    durationMs: Date.now() - started,
  });

  return { result, def };
}
