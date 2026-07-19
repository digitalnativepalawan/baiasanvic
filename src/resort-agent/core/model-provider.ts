/**
 * Model-provider abstraction. The Resort Agent core is provider-independent:
 * it never calls OpenRouter/Ollama directly. Adapters wrap the existing BAIA
 * provider implementations (see adapters/openrouter.ts, adapters/ollama.ts).
 *
 * Ported concept from Onyx resort-agent manifest.json "action_levels":
 *   automatic / approval_required / never_autonomous.
 */

export interface AgentModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentModelInput {
  system: string;
  messages: AgentModelMessage[];
  /** Optional structured-output hint (provider may ignore). */
  temperature?: number;
}

export interface AgentModelOutput {
  text: string;
}

export interface AgentModelProvider {
  generate(input: AgentModelInput): Promise<AgentModelOutput>;
}

/**
 * Action levels — single source of truth for what the agent may do on its own.
 * Anything in APPROVAL_REQUIRED must be held for owner sign-off.
 * NEVER_AUTONOMOUS are hard-blocked regardless of confidence.
 */
export const AUTOMATIC_ACTIONS = new Set([
  "answer_faq",
  "explain_room",
  "directions",
  "recommend",
  "collect_dates",
  "create_guest_lead",
  "draft_rate_request",
]);

export const APPROVAL_REQUIRED_ACTIONS = new Set([
  "send_quotation",
  "offer_discount",
  "confirm_availability",
  "confirm_booking",
  "change_dates",
  "promise_refund",
  "send_followup",
  "escalate_with_compensation",
  "proposed_transfer",
]);

export const NEVER_AUTONOMOUS = new Set([
  "charge_guest",
  "refund_money",
  "change_published_rates",
  "cancel_confirmed_booking",
  "delete_guest_info",
  "deploy_production",
]);

/** Returns true if the action is allowed automatically (no owner approval). */
export function isAutomatic(action: string): boolean {
  return AUTOMATIC_ACTIONS.has(action) && !NEVER_AUTONOMOUS.has(action);
}

/** Returns true if the action requires owner approval before any external effect. */
export function requiresApproval(action: string): boolean {
  return APPROVAL_REQUIRED_ACTIONS.has(action) || NEVER_AUTONOMOUS.has(action);
}
