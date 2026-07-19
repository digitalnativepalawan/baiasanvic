/**
 * Runtime repository interfaces — the agent runtime depends ONLY on these, never
 * on Supabase directly. Swap the implementation (memory vs supabase) by config.
 * All methods are resort-scoped; the Supabase adapter enforces resort_id on
 * every row. BAIA-free: no resort-specific data is referenced here.
 */
import type {
  AgentGoal,
  AgentEvent,
  AgentRun,
  AgentCycle,
  ScheduledAgentEvent,
} from "./types.ts";

export interface GoalRepository {
  create(goal: AgentGoal): Promise<AgentGoal>;
  update(id: string, patch: Partial<AgentGoal>): Promise<AgentGoal>;
  get(id: string): Promise<AgentGoal | null>;
  getActiveForConversation(resortId: string, conversationId: string): Promise<AgentGoal | null>;
  listStale(resortId: string, before: string): Promise<AgentGoal[]>;
}

export interface EventRepository {
  create(ev: AgentEvent): Promise<AgentEvent>;
  markProcessed(id: string, status: AgentEventProcessingStatus): Promise<void>;
  getByProcessingStatus(resortId: string, status: string): Promise<AgentEvent[]>;
  getByGoal(goalId: string): Promise<AgentEvent[]>;
}

export interface RunRepository {
  create(run: AgentRun): Promise<AgentRun>;
  addCycle(runId: string, cycleId: string): Promise<void>;
  get(runId: string): Promise<AgentRun | null>;
}

export interface CycleRepository {
  create(cycle: AgentCycle): Promise<AgentCycle>;
  update(id: string, patch: Partial<AgentCycle>): Promise<AgentCycle>;
  get(id: string): Promise<AgentCycle | null>;
  listByGoal(goalId: string): Promise<AgentCycle[]>;
}

export interface ActionRepository {
  create(action: AgentActionRecord): Promise<AgentActionRecord>;
  update(id: string, patch: Partial<AgentActionRecord>): Promise<AgentActionRecord>;
  get(id: string): Promise<AgentActionRecord | null>;
}

export interface AgentActionRecord {
  id: string;
  resortId: string;
  goalId: string;
  cycleId: string;
  toolName: string;
  status: string;
  output?: unknown;
  error?: string;
  evidence?: Record<string, unknown>;
  retryable: boolean;
  attempt: number;
  createdAt: string;
}

export interface SchedulerRepository {
  schedule(ev: ScheduledAgentEvent): Promise<void>;
  cancel(eventId: string): Promise<void>;
  getDue(resortId: string, now: string): Promise<ScheduledAgentEvent[]>;
  getByGoal(goalId: string): Promise<ScheduledAgentEvent[]>;
}

export interface AgentRuntimeRepositories {
  goals: GoalRepository;
  events: EventRepository;
  runs: RunRepository;
  cycles: CycleRepository;
  actions: ActionRepository;
  scheduler: SchedulerRepository;
}

// Re-declared here to avoid a circular import with the adapters layer.
export type AgentEventProcessingStatus =
  | "pending"
  | "processing"
  | "processed"
  | "skipped"
  | "failed";
