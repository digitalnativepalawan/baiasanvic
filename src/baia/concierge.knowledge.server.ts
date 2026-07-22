/**
 * Server-only loader for admin-authored knowledge rows in
 * public.concierge_knowledge. Emits KnowledgeChunk[] shaped the same as the
 * static chunks so retrieval + deterministic answering treat them uniformly.
 * Prices are stripped defensively; the deterministic layer also strips.
 */
import type { KnowledgeChunk } from "./concierge.knowledge";
import { stripMonetary } from "./concierge.knowledge";

export interface KnowledgeRow {
  id: string;
  topic: string;
  label: string;
  body: string;
  tags: string[];
  enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export async function loadKnowledgeRows(opts: {
  enabledOnly?: boolean;
} = {}): Promise<KnowledgeRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("concierge_knowledge")
    .select("id, topic, label, body, tags, enabled, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (opts.enabledOnly) q = q.eq("enabled", true);
  const { data, error } = await q;
  if (error) {
    console.error("loadKnowledgeRows failed:", error.message);
    return [];
  }
  return (data ?? []) as KnowledgeRow[];
}

/**
 * Turn admin rows into KnowledgeChunks. Tags are appended to the searchable
 * body so keyword retrieval matches on them; the ID is prefixed `db:` so
 * downstream code can distinguish DB-backed knowledge from static.
 */
export async function loadDbKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  const rows = await loadKnowledgeRows({ enabledOnly: true });
  return rows.map((r) => {
    const tagLine = r.tags?.length ? `\nTags: ${r.tags.join(", ")}` : "";
    return {
      id: `db:${r.id}`,
      label: r.label || r.topic,
      text: stripMonetary(`${r.body}${tagLine}`.trim()),
    };
  });
}
