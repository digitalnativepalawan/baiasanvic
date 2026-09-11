/**
 * Types for the TALA agent.
 *
 * TALA is BAIA's in-app agent (one brain, two surfaces):
 *   - GUEST surface: public site chat — read-only knowledge/content tools +
 *     lead capture, strict no-pricing guardrails.
 *   - ADMIN surface: owner console in the admin panel — passkey-gated
 *     read/write tools over site content, knowledge, bookings, and ops tables.
 *
 * TALA replaced the earlier design of proxying to a local Python "Hermes"
 * service: that service could only run on a single machine, so the agent now
 * lives entirely in server functions and uses the owner-configured
 * OpenRouter/Ollama provider, falling back to the deterministic knowledge
 * layer when no provider is configured.
 */

export type TalaSurfaceName = "guest" | "admin";

/** A single executed action, surfaced to the UI as an evidence chip. */
export interface TalaAction {
  name: string;
  status: "success" | "error";
  /** Compact JSON evidence (record id, counts, path written…) — no secrets. */
  evidenceJson?: string;
}

export interface TalaChatRequest {
  message: string;
  sessionId: string;
  /** Which toolset + guardrails apply. Admin requires `passkey`. */
  surface: TalaSurfaceName;
  /** Admin passkey — required when surface === "admin". */
  passkey?: string;
  /** Prior turns for context (guest/agent pairs). */
  history?: Array<{ role: "guest" | "agent"; content: string }>;
}

export interface TalaChatResponse {
  reply: string;
  /** Which brain produced the reply. */
  brain: "tala" | "onyx" | "deterministic" | "fallback" | "error";
  /** Tool calls executed this turn (evidence trail for the UI). */
  actions: TalaAction[];
  /** Present only for admin-surface errors (bad passkey, provider down…). */
  error?: string;
}

export interface TalaStatus {
  status: "online" | "degraded" | "offline";
  /** Active LLM provider for the agentic loop, if any. */
  provider: "openrouter" | "ollama" | "none";
  model: string;
  /** True when the deterministic knowledge layer can answer without a model. */
  knowledgeLayerReady: boolean;
  /** Counts shown in the admin console. */
  knowledgeEntries: number;
  staticTopics: number;
  pendingInquiries: number;
  actionsLast24h: number;
  tools: { guest: string[]; admin: string[] };
  /** False when Supabase is unreachable — tools degrade gracefully. */
  databaseReachable: boolean;
  /** Notes for the admin UI (e.g. missing SQL, no provider configured). */
  notes: string[];
}

/** Wire-serializable tool arguments (server fn boundary requires concrete JSON). */
export type TalaActionArgs = Record<string, string | number | boolean | null>;

export interface TalaActionLogEntry {
  id: string;
  session_id: string;
  surface: TalaSurfaceName;
  tool: string;
  status: "success" | "error";
  arguments: TalaActionArgs;
  result_summary: string | null;
  duration_ms: number;
  created_at: string;
}
