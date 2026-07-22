import { createServerFn } from "@tanstack/react-start";

import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  verifyAdminPasskey,
} from "./admin.server";

export const uploadSiteAsset = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      passkey: string;
      filename: string;
      contentType: string;
      base64: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    verifyAdminPasskey(data.passkey);

    const contentType = (data.contentType || "").toLowerCase();
    const isImage = ALLOWED_IMAGE_MIME_TYPES.has(contentType);
    const isVideo = ALLOWED_VIDEO_MIME_TYPES.has(contentType);
    if (!isImage && !isVideo) {
      throw new Error(
        "Unsupported file type. Use WEBP, PNG, JPG/JPEG, SVG for images or MP4/WEBM for videos.",
      );
    }

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength === 0) throw new Error("Empty file");
    const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (bytes.byteLength > cap) {
      throw new Error(
        `File too large (${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB). Max ${cap / 1024 / 1024} MB.`,
      );
    }

    const ext = (data.filename.split(".").pop() || "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "bin";
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("site-assets")
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    return { url: `/api/site-assets/${path}`, path };
  });

export const saveSiteState = createServerFn({ method: "POST" })
  .inputValidator((data: { passkey: string; state: unknown }) => data)
  .handler(async ({ data }) => {
    verifyAdminPasskey(data.passkey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_state")
      .upsert(
        {
          key: "default",
          data: data.state as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) throw new Error(`Save failed: ${error.message}`);
    return { ok: true };
  });

// ─── Concierge knowledge base CRUD ──────────────────────────────────────────
// All gated by the admin passkey. Rows live in public.concierge_knowledge
// and are read at request time by the concierge server for retrieval /
// deterministic answering.

export interface KnowledgeInput {
  id?: string;
  topic: string;
  label: string;
  body: string;
  tags?: string[];
  enabled?: boolean;
  sort_order?: number;
}

export const listKnowledge = createServerFn({ method: "POST" })
  .inputValidator((data: { passkey: string }) => data)
  .handler(async ({ data }) => {
    verifyAdminPasskey(data.passkey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("concierge_knowledge")
      .select("id, topic, label, body, tags, enabled, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw new Error(`List failed: ${error.message}`);
    return { rows: rows ?? [] };
  });

function normalizeEntry(entry: KnowledgeInput) {
  const topic = (entry.topic || "").trim().slice(0, 80);
  const label = (entry.label || "").trim().slice(0, 200);
  const body = (entry.body || "").trim().slice(0, 8000);
  if (!topic) throw new Error("Topic is required.");
  if (!label) throw new Error("Label is required.");
  if (!body) throw new Error("Body is required.");
  const tags = Array.isArray(entry.tags)
    ? entry.tags
        .map((t) => String(t).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 30)
    : [];
  return {
    topic,
    label,
    body,
    tags,
    enabled: entry.enabled ?? true,
    sort_order: Number.isFinite(entry.sort_order) ? Number(entry.sort_order) : 0,
  };
}

export const upsertKnowledge = createServerFn({ method: "POST" })
  .inputValidator((data: { passkey: string; entry: KnowledgeInput }) => data)
  .handler(async ({ data }) => {
    verifyAdminPasskey(data.passkey);
    const normalized = normalizeEntry(data.entry);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.entry.id) {
      const { data: row, error } = await supabaseAdmin
        .from("concierge_knowledge")
        .update(normalized)
        .eq("id", data.entry.id)
        .select()
        .single();
      if (error) throw new Error(`Update failed: ${error.message}`);
      return { row };
    }
    const { data: row, error } = await supabaseAdmin
      .from("concierge_knowledge")
      .insert(normalized)
      .select()
      .single();
    if (error) throw new Error(`Insert failed: ${error.message}`);
    return { row };
  });

export const deleteKnowledge = createServerFn({ method: "POST" })
  .inputValidator((data: { passkey: string; id: string }) => data)
  .handler(async ({ data }) => {
    verifyAdminPasskey(data.passkey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("concierge_knowledge")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(`Delete failed: ${error.message}`);
    return { ok: true };
  });

export const bulkImportKnowledge = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { passkey: string; entries: KnowledgeInput[]; mode: "append" | "replace" }) => data,
  )
  .handler(async ({ data }) => {
    verifyAdminPasskey(data.passkey);
    if (!Array.isArray(data.entries) || data.entries.length === 0) {
      throw new Error("No entries to import.");
    }
    if (data.entries.length > 2000) {
      throw new Error("Too many entries in one upload (max 2000).");
    }
    const rows = data.entries.map(normalizeEntry);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.mode === "replace") {
      const { error: delErr } = await supabaseAdmin
        .from("concierge_knowledge")
        .delete()
        .not("id", "is", null);
      if (delErr) throw new Error(`Wipe failed: ${delErr.message}`);
    }
    const { error, count } = await supabaseAdmin
      .from("concierge_knowledge")
      .insert(rows, { count: "exact" });
    if (error) throw new Error(`Import failed: ${error.message}`);
    return { inserted: count ?? rows.length, mode: data.mode };
  });

