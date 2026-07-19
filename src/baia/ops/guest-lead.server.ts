/**
 * MerQato Operations API — guest lead handler (SERVER-ONLY).
 *
 * This is the controlled write boundary that Onyx tools call. Onyx NEVER gets
 * Supabase service-role credentials; it only sees this endpoint's contract and
 * authenticates with ONYX_OPERATIONS_API_SECRET.
 *
 * Responsibilities (per stage spec):
 *   - Authenticate the request (bearer secret)
 *   - Validate resort_id
 *   - Validate the tool payload
 *   - Reject monetary fields (absolute pricing rule)
 *   - Reject unsupported actions
 *   - Enforce idempotency (same idempotency_key => same lead, no duplicate)
 *   - Write through the server-side repository (Supabase when confirmed, else
 *     a clearly-labelled TEST persistence adapter)
 *   - Return structured evidence (record id + verification)
 *   - Never expose the Supabase service-role key
 *
 * Persistence status: Supabase is used only when David has applied the
 * booking_inquiries extension (adds resort_id, idempotency_key, channel, phone,
 * room_preference, children_count, transport_needed, notes; relaxes NOT NULL for
 * partial Onyx leads; partial-unique idempotency index) AND sets
 * MERQATO_SUPABASE_OPS_CONFIRMED=1. Until then this uses the TEST adapter
 * (in-process, clearly labelled) so the end-to-end path is provable without
 * inventing a fake success.
 */

// ---- Idempotency key (shared by every caller: Onyx tool, core/OpenRouter path) --

import { createHash } from "node:crypto";

/**
 * Deterministic idempotency key for a guest inquiry, shared by every caller
 * that can create a lead (Onyx's create_guest_lead tool AND the core/
 * OpenRouter path in concierge.server.ts). Same conversation + same
 * normalized inquiry text => same key => the same confirmed inquiry never
 * creates a second lead, regardless of which brain answered the turn.
 */
export function deriveGuestLeadIdempotencyKey(conversationId: string, message: string): string {
  const normalized = message.toLowerCase().replace(/\s+/g, " ").trim();
  const basis = `${conversationId}|${normalized}`;
  const hash = createHash("sha256").update(basis).digest("hex").slice(0, 24);
  return `baia-${hash}`;
}

// ---- Types ------------------------------------------------------------------

export interface GuestLeadInput {
  resort_id: string;
  idempotency_key: string;
  channel: string;
  guest?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  stay?: {
    check_in?: string; // ISO date
    check_out?: string; // ISO date
    adults?: number;
    children?: number;
    room_preference?: string;
    transport_needed?: boolean;
  };
  notes?: string;
}

export interface GuestLeadEvidence {
  ok: boolean;
  action: "create_guest_lead";
  lead_id: string;
  resort_id: string;
  idempotency_key: string;
  created: boolean; // true = new row, false = idempotent hit (existing)
  verified: boolean; // re-read confirms the row exists
  persistence: "supabase" | "test-adapter";
  verification: {
    method: string;
    found: boolean;
    lead_id: string | null;
  };
  stored: {
    guest_name: string | null;
    email: string | null;
    phone: string | null;
    check_in: string | null;
    check_out: string | null;
    adults: number | null;
    children: number | null;
    room_preference: string | null;
    transport_needed: boolean | null;
    status: string;
  };
  error?: string;
}

// ---- Config -----------------------------------------------------------------

const ALLOWED_RESORT_IDS = new Set<string>(["baia-san-vicente"]);

// Fields that must NEVER appear in a lead payload (absolute pricing rule).
const FORBIDDEN_MONETARY_KEYS = [
  "price",
  "prices",
  "rate",
  "rates",
  "quote",
  "quoted",
  "amount",
  "total",
  "cost",
  "fee",
  "deposit",
  "discount",
  "currency",
  "php",
  "usd",
  "peso",
  "pesos",
  "subtotal",
  "nightly",
  "per_night",
  "price_per_night",
];

// ---- Auth -------------------------------------------------------------------

export function verifyOnyxOpsSecret(authHeader: string | null): void {
  const expected = process.env.ONYX_OPERATIONS_API_SECRET;
  if (!expected) {
    throw new OpsError(500, "ONYX_OPERATIONS_API_SECRET not configured on server");
  }
  if (!authHeader) throw new OpsError(401, "Missing Authorization header");
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  // Constant-time-ish comparison.
  if (token.length !== expected.length) throw new OpsError(403, "Invalid operations secret");
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw new OpsError(403, "Invalid operations secret");
}

export class OpsError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---- Validation -------------------------------------------------------------

function assertNoMonetaryFields(obj: unknown, path = ""): void {
  if (obj == null || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const keyLower = k.toLowerCase();
    if (FORBIDDEN_MONETARY_KEYS.some((f) => keyLower === f || keyLower.includes(f))) {
      throw new OpsError(422, `Monetary field rejected: '${path}${k}' (absolute pricing rule)`);
    }
    if (v && typeof v === "object") assertNoMonetaryFields(v, `${path}${k}.`);
  }
}

export function validateGuestLead(input: GuestLeadInput): void {
  if (!input || typeof input !== "object") throw new OpsError(422, "Body must be an object");
  if (!input.resort_id) throw new OpsError(422, "resort_id is required");
  if (!ALLOWED_RESORT_IDS.has(input.resort_id)) {
    throw new OpsError(422, `Unknown resort_id: '${input.resort_id}'`);
  }
  if (!input.idempotency_key || input.idempotency_key.length < 6) {
    throw new OpsError(422, "idempotency_key is required (min 6 chars)");
  }
  if (!input.channel) throw new OpsError(422, "channel is required");
  // Reject monetary fields anywhere in the payload.
  assertNoMonetaryFields(input);
  // A lead never confirms availability or a booking — reject those signals.
  const notes = (input.notes ?? "").toLowerCase();
  if (/\b(confirmed|booking confirmed|reserved|guaranteed available)\b/.test(notes)) {
    throw new OpsError(422, "Lead must not confirm availability or a booking");
  }
}

// ---- Persistence: TEST adapter (labelled) ----------------------------------

interface StoredLead {
  id: string;
  resort_id: string;
  idempotency_key: string;
  channel: string;
  guest_name: string | null;
  email: string | null;
  phone: string | null;
  check_in: string | null;
  check_out: string | null;
  adults: number | null;
  children: number | null;
  room_preference: string | null;
  transport_needed: boolean | null;
  notes: string | null;
  status: string;
  created_at: string;
}

// In-process store keyed by resort_id + idempotency_key. Clearly a TEST adapter.
// Survives within one server process only. Never used when Supabase is confirmed.
const TEST_STORE: Map<string, StoredLead> = (() => {
  const g = globalThis as unknown as { __MERQATO_TEST_LEADS__?: Map<string, StoredLead> };
  if (!g.__MERQATO_TEST_LEADS__) g.__MERQATO_TEST_LEADS__ = new Map();
  return g.__MERQATO_TEST_LEADS__;
})();

function idemKey(resortId: string, key: string): string {
  return `${resortId}::${key}`;
}

function newLeadId(): string {
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Supabase confirmation gate --------------------------------------------

/**
 * Supabase is only used when BOTH the env credentials exist AND the tables are
 * confirmed applied. David confirms by setting MERQATO_SUPABASE_OPS_CONFIRMED=1
 * after running the manual SQL. Until then we use the TEST adapter.
 */
function supabaseConfirmed(): boolean {
  return (
    process.env.MERQATO_SUPABASE_OPS_CONFIRMED === "1" &&
    !!process.env.SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ---- Main handler -----------------------------------------------------------

export async function handleCreateGuestLead(input: GuestLeadInput): Promise<GuestLeadEvidence> {
  validateGuestLead(input);

  if (supabaseConfirmed()) {
    return await createGuestLeadSupabase(input);
  }
  return createGuestLeadTest(input);
}

function toEvidence(
  row: StoredLead,
  created: boolean,
  persistence: "supabase" | "test-adapter",
  verifiedRow: StoredLead | null,
): GuestLeadEvidence {
  return {
    ok: true,
    action: "create_guest_lead",
    lead_id: row.id,
    resort_id: row.resort_id,
    idempotency_key: row.idempotency_key,
    created,
    verified: !!verifiedRow && verifiedRow.id === row.id,
    persistence,
    verification: {
      method: persistence === "supabase" ? "select-by-id" : "map-get-by-idempotency",
      found: !!verifiedRow,
      lead_id: verifiedRow ? verifiedRow.id : null,
    },
    stored: {
      guest_name: row.guest_name,
      email: row.email,
      phone: row.phone,
      check_in: row.check_in,
      check_out: row.check_out,
      adults: row.adults,
      children: row.children,
      room_preference: row.room_preference,
      transport_needed: row.transport_needed,
      status: row.status,
    },
  };
}

function createGuestLeadTest(input: GuestLeadInput): GuestLeadEvidence {
  const k = idemKey(input.resort_id, input.idempotency_key);
  const existing = TEST_STORE.get(k);
  if (existing) {
    // Idempotent hit — verify by re-reading, return existing (no duplicate).
    const verified = TEST_STORE.get(k) ?? null;
    return toEvidence(existing, false, "test-adapter", verified);
  }
  const row: StoredLead = {
    id: newLeadId(),
    resort_id: input.resort_id,
    idempotency_key: input.idempotency_key,
    channel: input.channel,
    guest_name: input.guest?.name ?? null,
    email: input.guest?.email ?? null,
    phone: input.guest?.phone ?? null,
    check_in: input.stay?.check_in ?? null,
    check_out: input.stay?.check_out ?? null,
    adults: input.stay?.adults ?? null,
    children: input.stay?.children ?? null,
    room_preference: input.stay?.room_preference ?? null,
    transport_needed: input.stay?.transport_needed ?? null,
    notes: input.notes ?? null,
    status: "new",
    created_at: new Date().toISOString(),
  };
  TEST_STORE.set(k, row);
  // Verify by re-reading from the store.
  const verified = TEST_STORE.get(k) ?? null;
  return toEvidence(row, true, "test-adapter", verified);
}

async function createGuestLeadSupabase(input: GuestLeadInput): Promise<GuestLeadEvidence> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Idempotency: look up existing by (resort_id, idempotency_key).
  const { data: existing, error: selErr } = await supabase
    .from("booking_inquiries")
    .select("id")
    .eq("resort_id", input.resort_id)
    .eq("idempotency_key", input.idempotency_key)
    .maybeSingle();
  if (selErr) throw new OpsError(502, `Supabase select failed: ${selErr.message}`);

  if (existing) {
    const { data: v } = await supabase
      .from("booking_inquiries")
      .select("*")
      .eq("id", existing.id)
      .maybeSingle();
    return toEvidence(
      rowFromSupabase(v, input),
      false,
      "supabase",
      v ? rowFromSupabase(v, input) : null,
    );
  }

  const insertRow = {
    resort_id: input.resort_id,
    idempotency_key: input.idempotency_key,
    channel: input.channel,
    guest_name: input.guest?.name ?? null,
    guest_email: input.guest?.email ?? null,
    phone: input.guest?.phone ?? null,
    check_in: input.stay?.check_in ?? null,
    check_out: input.stay?.check_out ?? null,
    guests_count: input.stay?.adults ?? null,
    children_count: input.stay?.children ?? null,
    room_preference: input.stay?.room_preference ?? null,
    transport_needed: input.stay?.transport_needed ?? null,
    notes: input.notes ?? null,
    status: "pending",
  };
  const { data: inserted, error: insErr } = await supabase
    .from("booking_inquiries")
    .insert(insertRow)
    .select("*")
    .single();
  if (insErr) throw new OpsError(502, `Supabase insert failed: ${insErr.message}`);

  // Verify by re-reading by id.
  const { data: verified } = await supabase
    .from("booking_inquiries")
    .select("*")
    .eq("id", inserted.id)
    .maybeSingle();

  return toEvidence(
    rowFromSupabase(inserted, input),
    true,
    "supabase",
    verified ? rowFromSupabase(verified, input) : null,
  );
}

function rowFromSupabase(r: Record<string, unknown> | null, input: GuestLeadInput): StoredLead {
  const g = (r ?? {}) as Record<string, unknown>;
  return {
    id: String(g.id ?? ""),
    resort_id: String(g.resort_id ?? input.resort_id),
    idempotency_key: String(g.idempotency_key ?? input.idempotency_key),
    channel: String(g.channel ?? input.channel),
    guest_name: (g.guest_name as string) ?? null,
    email: (g.guest_email as string) ?? null,
    phone: (g.phone as string) ?? null,
    check_in: (g.check_in as string) ?? null,
    check_out: (g.check_out as string) ?? null,
    adults: (g.guests_count as number) ?? null,
    children: (g.children_count as number) ?? null,
    room_preference: (g.room_preference as string) ?? null,
    transport_needed: (g.transport_needed as boolean) ?? null,
    notes: (g.notes as string) ?? null,
    status: String(g.status ?? "new"),
    created_at: String(g.created_at ?? new Date().toISOString()),
  };
}
