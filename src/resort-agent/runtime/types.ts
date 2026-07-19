/**
 * Autonomous runtime types — reusable, BAIA-free.
 *
 * These models turn the single-cycle runResortAgent() into a persistent,
 * event-driven agent that maintains an active business goal across many cycles,
 * pauses for approval, schedules future work, and verifies outcomes.
 *
 * No resort name, location, room, policy, contact, brand, link, or price is
 * hard-coded here. Resort-specific values arrive via repository data only.
 *
 * Source attribution: orchestration/event/goal concepts ported from Onyx
 * skills/builtin/resort-agent (MIT). The Onyx loop was single-shot; this adds
 * multi-cycle state, scheduling, and verification per the governing spec.
 */

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
export type AgentGoalStatus =
  | "active"
  | "waiting_for_guest"
  | "waiting_for_approval"
  | "waiting_for_time"
  | "blocked"
  | "completed"
  | "lost"
  | "escalated"
  | "cancelled";

export type AgentGoalType =
  | "qualify_booking_inquiry"
  | "obtain_current_rate"
  | "confirm_current_availability"
  | "resolve_guest_service_request"
  | "handle_complaint"
  | "follow_up_lead"
  | "complete_human_handoff";

export interface AgentGoal {
  id: string;
  resortId: string;
  conversationId?: string;
  leadId?: string;

  goalType: AgentGoalType;
  objective: string;
  status: AgentGoalStatus;

  successCriteria: string[];
  blockers: string[];
  missingInformation: string[];

  currentStep?: string;
  nextReviewAt?: string;

  // Loop-safety / scheduling bookkeeping.
  cycleCount: number;
  lastProcessedAt?: string;
  staleAt?: string;

  // Actions already approved by an owner (scope-bound: toolName + input hash).
  approvedActions?: string[];

  // Collected structured state (e.g. extracted booking details) persisted across
  // cycles so a resumed goal does not re-ask for already-supplied info.
  state?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export type AgentEventType =
  | "guest_message_received"
  | "admin_message_received"
  | "approval_granted"
  | "approval_rejected"
  | "follow_up_due"
  | "lead_stale"
  | "action_succeeded"
  | "action_failed"
  | "booking_confirmed"
  | "booking_declined"
  | "guest_unresponsive"
  | "manual_resume"
  | "goal_cancelled";

export type AgentEventProcessingStatus =
  | "pending"
  | "processing"
  | "processed"
  | "skipped"
  | "failed";

export interface AgentEvent {
  id: string;
  resortId: string;
  goalId?: string;
  conversationId?: string;
  leadId?: string;

  type: AgentEventType;
  payload: Record<string, unknown>;
  source: "guest" | "admin" | "system" | "scheduler";

  idempotencyKey: string;
  processingStatus: AgentEventProcessingStatus;

  createdAt: string;
  processedAt?: string;
}

// ---------------------------------------------------------------------------
// Runs / cycles
// ---------------------------------------------------------------------------
export type AgentCycleStatus = "running" | "waiting" | "completed" | "failed" | "blocked";

export interface PlannedAction {
  toolName: string;
  actionLevel: "automatic" | "approval_required" | "never_autonomous";
  input: unknown;
  reasoning: string;
  requiresApproval: boolean;
}

export interface AgentPlan {
  goalId: string;
  reasoningSummary: string; // safe operational explanation, no hidden model reasoning
  blockers: string[];
  actions: PlannedAction[];
  expectedOutcome: string;
  nextState: AgentGoalStatus;
}

export interface AgentCycle {
  id: string;
  resortId: string;
  goalId: string;
  runId: string;

  triggerEventId: string;
  goalSnapshot: AgentGoal;
  knowledgeUsed?: Record<string, unknown>;
  plan: AgentPlan;
  actionsAttempted: string[]; // action ids
  actionsCompleted: string[];
  approvalRequestsCreated: string[];
  errors: string[];
  verificationResult?: {
    verified: boolean;
    notes: string;
    evidence: Record<string, unknown>;
  };
  nextScheduledEventId?: string;
  status: AgentCycleStatus;

  startedAt: string;
  finishedAt?: string;
}

export interface AgentRun {
  id: string;
  resortId: string;
  goalId: string;
  cycles: string[]; // cycle ids
  startedAt: string;
  finishedAt?: string;
}

// ---------------------------------------------------------------------------
// Actions (executed results)
// ---------------------------------------------------------------------------
export type AgentActionStatus =
  | "succeeded"
  | "failed"
  | "pending_approval"
  | "deferred";

export interface AgentActionResult {
  actionId: string;
  toolName: string;
  status: AgentActionStatus;
  output?: unknown;
  error?: string;
  evidence?: Record<string, unknown>;
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------
export type ScheduledAgentEventType =
  | "follow_up_due"
  | "lead_stale"
  | "approval_expired"
  | "guest_unresponsive"
  | "goal_review"
  | "retry";

export interface ScheduledAgentEvent {
  id: string;
  resortId: string;
  goalId?: string;
  leadId?: string;
  eventType: ScheduledAgentEventType;
  payload: Record<string, unknown>;
  dueAt: string; // ISO
  createdAt: string;
  cancelled?: boolean;
}

// ---------------------------------------------------------------------------
// Runtime configuration (safety defaults; configuration-driven)
// ---------------------------------------------------------------------------
export interface AgentRuntimeConfig {
  maxActionsPerCycle: number;
  maxCyclesPerGoalWindow: number;
  cycleWindowMs: number;
  maxRetries: number;
  retryDelayMs: number;
  goalStaleMs: number;
  approvalTtlMs: number;
  maxActionsPerGoalTotal: number;
}

export const DEFAULT_RUNTIME_CONFIG: AgentRuntimeConfig = {
  maxActionsPerCycle: 6,
  maxCyclesPerGoalWindow: 20,
  cycleWindowMs: 1000 * 60 * 60 * 24, // 24h
  maxRetries: 3,
  retryDelayMs: 1000 * 60 * 30, // 30m
  goalStaleMs: 1000 * 60 * 60 * 24 * 7, // 7d
  approvalTtlMs: 1000 * 60 * 60 * 24 * 3, // 3d
  maxActionsPerGoalTotal: 60,
};
