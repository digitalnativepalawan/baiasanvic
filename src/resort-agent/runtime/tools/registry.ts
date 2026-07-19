/**
 * Tool registry interface — ported from Onyx action model. Each tool is an
 * explicit, verifiable unit of work. The LLM may help phrase, but deterministic
 * policy decides whether a tool is allowed to run, requires approval, or is
 * never autonomous. No tool here calculates or states a price.
 */
import type {
  AgentActionResult,
  AgentGoal,
  AgentEventType,
} from "./types.ts";
import type { AgentRuntimeRepositories } from "./repositories.ts";

export type ToolActionLevel = "automatic" | "approval_required" | "never_autonomous";

export interface ToolValidationResult {
  ok: boolean;
  error?: string;
}

export interface ToolExecutionContext {
  resortId: string;
  goalId: string;
  cycleId: string;
  conversationId?: string;
  leadId?: string;
  /** The active conversational reply produced so far (for guest-facing tools). */
  reply: string;
  /** Resort-knowledge bag (non-monetary) available to the agent. */
  knowledge?: unknown;
  /** Channels available for later (external send) — not used yet. */
  runtime: AgentRuntimeRepositories;
  /** Whether the Supabase-backed store is confirmed (else deferred). */
  persistent: boolean;
  now: string;
}

export interface ToolExecutionResult {
  ok: boolean;
  output?: unknown;
  error?: string;
  retryable: boolean;
}

export interface ToolVerificationResult {
  verified: boolean;
  notes: string;
  evidence: Record<string, unknown>;
}

export interface ResortAgentTool {
  name: string;
  description: string;
  actionLevel: ToolActionLevel;

  validate(input: unknown, ctx: ToolExecutionContext): ToolValidationResult;
  execute(input: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionResult>;
  verify?(result: ToolExecutionResult, ctx: ToolExecutionContext): Promise<ToolVerificationResult>;
}
