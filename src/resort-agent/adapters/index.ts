/**
 * Repository factory — selects the persistence implementation.
 *
 * Selection (server-only; never exposed to the browser):
 *   RESORT_AGENT_PERSISTENCE=supabase  -> Supabase adapter (only if confirmed)
 *   anything else / unset              -> Memory adapter (development/default)
 *
 * The Supabase adapter is DISABLED until the owner confirms the manual SQL ran.
 * We track that confirmation in-memory here (set via markSupabaseConfirmed()).
 * Until confirmed, even if the env says supabase, we fall back to memory and
 * every write reports databaseWriteDeferred: true.
 */
import type { ResortAgentRepositories } from "./repositories.ts";
import { createMemoryRepositories, type MemoryAdapter } from "./memory.ts";

let supabaseConfirmed = false;

/** Call this only after the owner confirms SQL applied successfully. */
export function markSupabaseConfirmed(): void {
  supabaseConfirmed = true;
}

export function isSupabaseConfirmed(): boolean {
  return supabaseConfirmed;
}

let cached: ResortAgentRepositories | null = null;

export function getRepositories(): ResortAgentRepositories {
  const wantSupabase = process.env.RESORT_AGENT_PERSISTENCE === "supabase";
  if (wantSupabase && supabaseConfirmed) {
    if (!cached) {
      // Lazy require so the memory-only path never loads Supabase deps.
      const { createSupabaseRepositories } = require("./supabase") as typeof import("./supabase.ts");
      cached = createSupabaseRepositories();
    }
    return cached;
  }
  if (!cached) cached = createMemoryRepositories();
  return cached;
}

export function getMemoryAdapter(): MemoryAdapter {
  const r = getRepositories();
  if ("__conversations" in r) return r as MemoryAdapter;
  // Should not happen in dev; create a fresh one for tests.
  return createMemoryRepositories();
}
