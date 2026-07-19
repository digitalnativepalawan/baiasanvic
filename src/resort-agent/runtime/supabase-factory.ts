/**
 * Supabase runtime factory — returns the Supabase runtime repositories ONLY when
 * the owner has confirmed supabase/manual_sql/002_agent_runtime.sql ran in
 * Lovable.dev. Until then returns null and the caller falls back to memory.
 *
 * The Supabase adapter (./supabase.ts) is never imported by the memory path,
 * so local/dev/test never pulls the supabase client. Selection is server-only.
 */
import type { AgentRuntimeRepositories } from "./repositories";

let confirmed = false;

/** Call only after the owner confirms the 002 SQL applied successfully. */
export function markSupabaseRuntimeConfirmed(): void {
  confirmed = true;
}

export function isSupabaseRuntimeConfirmed(): boolean {
  return confirmed;
}

export function createSupabaseRuntimeRepositoriesIfConfirmed(): AgentRuntimeRepositories | null {
  if (!confirmed) return null;
  if (process.env.RESORT_AGENT_PERSISTENCE !== "supabase") return null;
  // Lazy require so the memory-only path never loads Supabase deps.
  const { createSupabaseRuntimeRepositories } = require("./supabase") as typeof import("./supabase");
  return createSupabaseRuntimeRepositories();
}
