/**
 * Compatibility bridge — keeps runResortAgent() as a backwards-compatible
 * guest-message entry point while routing through the autonomous runtime.
 *
 * runResortAgent(message, opts) -> creates a guest_message_received event
 *   -> submitEvent(runtime, event) -> goal created/resumed, reply produced.
 *
 * No BAIA-specific behavior lives here; the runtime is reusable. The Supabase
 * runtime is selected only when RESORT_AGENT_PERSISTENCE=supabase and the
 * owner has confirmed 002_agent_runtime.sql.
 */
import { submitEvent } from "./engine";
import { createMemoryRuntime } from "./memory";
import { createSupabaseRuntimeRepositoriesIfConfirmed } from "./supabase-factory";
import type { AgentRuntime } from "./engine";

let cached: AgentRuntime | null = null;

/**
 * Returns the configured runtime. Defaults to the in-memory adapter; uses the
 * Supabase adapter only when the owner confirmed the SQL (set via
 * markSupabaseRuntimeConfirmed in supabase-factory).
 */
export function getRuntime(): AgentRuntime {
  if (cached) return cached;
  const supa = createSupabaseRuntimeRepositoriesIfConfirmed();
  cached = supa ?? createMemoryRuntime();
  return cached;
}

export interface CompatRunResult {
  reply: string;
  intent: string;
  approvalRequired: boolean;
  databaseWriteDeferred: boolean;
  goalId?: string;
  cycleId?: string;
}

export async function runResortAgentCompat(input: {
  resortId: string;
  conversationId: string;
  messageId: string;
  message: string;
  guest?: { name?: string; email?: string; phone?: string };
}): Promise<CompatRunResult> {
  const rt = getRuntime();
  const res = await submitEvent(rt, {
    resortId: input.resortId,
    conversationId: input.conversationId,
    type: "guest_message_received",
    payload: { message: input.message, messageId: input.messageId, guest: input.guest ?? {} },
    source: "guest",
    idempotencyKey: `guest_${input.conversationId}_${input.messageId}`,
  });
  // Translate runtime cycle -> compat result (mirrors the prior single-cycle API).
  const goalId = res.cycle?.goalId;
  const status = res.cycle?.goalSnapshot.status;
  return {
    reply: res.reply,
    intent: res.cycle?.goalSnapshot.goalType ?? "general",
    approvalRequired: status === "waiting_for_approval",
    databaseWriteDeferred: !isSupabaseActive(),
    goalId,
    cycleId: res.cycle?.id,
  };
}

function isSupabaseActive(): boolean {
  // True only when the supabase factory confirmed + selected it.
  return !!createSupabaseRuntimeRepositoriesIfConfirmed();
}
