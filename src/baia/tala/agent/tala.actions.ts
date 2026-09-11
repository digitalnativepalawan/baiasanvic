/**
 * TALA action log (SERVER-ONLY).
 *
 * Every tool execution TALA performs — guest or admin surface — is written to
 * the `tala_action_log` table as an evidence trail: which tool, on which
 * surface, from which session, with what arguments/result summary, and how
 * long it took. The admin console renders this trail live.
 *
 * FAIL-SAFE BY DESIGN: the log is an observability aid, never a dependency.
 * If the table is missing (SQL not applied yet), unreachable, or the write
 * fails, we log to the server console and move on. A missing action log must
 * never break a guest turn or an admin action.
 *
 * Schema (supabase/manual_sql/004_tala_agent.sql):
 *   tala_action_log (
 *     id uuid pk, session_id text, surface text, tool text,
 *     status text, arguments jsonb, result_summary text,
 *     duration_ms int, created_at timestamptz )
 */
import type { TalaActionLogEntry, TalaActionArgs } from "../tala.types";

export type TalaSurface = "guest" | "admin";

export interface LogActionInput {
  sessionId: string;
  surface: TalaSurface;
  tool: string;
  status: "success" | "error";
  /** Tool arguments (already small — the registry caps payload sizes). */
  args?: Record<string, unknown>;
  /** Short human-readable result summary (no secrets, no full dumps). */
  resultSummary?: string;
  durationMs: number;
}

export function summarizeForLog(v: unknown, max = 280): string {
  if (v === undefined || v === null) return "";
  let s: string;
  try {
    s = typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    s = String(v);
  }
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * Coerce arbitrary tool arguments into a wire-serializable shape for the
 * server-function boundary (strings capped, nested values JSON-encoded).
 */
function wireSafeArgs(v: unknown): TalaActionArgs {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: TalaActionArgs = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val.slice(0, 200);
    else if (typeof val === "number" || typeof val === "boolean" || val === null) out[k] = val;
    else out[k] = summarizeForLog(val, 200);
  }
  return out;
}

export async function logTalaAction(entry: LogActionInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tala_action_log").insert({
      session_id: entry.sessionId,
      surface: entry.surface,
      tool: entry.tool,
      status: entry.status,
      arguments: entry.args ?? {},
      result_summary: summarizeForLog(entry.resultSummary ?? ""),
      duration_ms: Math.round(entry.durationMs),
    });
    if (error) {
      // Expected when 004_tala_agent.sql hasn't been applied yet — degrade quietly.
      console.warn(`[TALA] action log unavailable (${error.message}); tool=${entry.tool}`);
    }
  } catch (err) {
    console.warn("[TALA] action log write failed:", err);
  }
}

export async function listTalaActions(limit = 25): Promise<TalaActionLogEntry[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tala_action_log")
      .select(
        "id, session_id, surface, tool, status, arguments, result_summary, duration_ms, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error) {
      console.warn(`[TALA] action log read unavailable (${error.message})`);
      return [];
    }
    return (data ?? []).map(
      (r) =>
        ({
          ...r,
          arguments: wireSafeArgs(r.arguments),
        }) as TalaActionLogEntry,
    );
  } catch (err) {
    console.warn("[TALA] action log read failed:", err);
    return [];
  }
}
