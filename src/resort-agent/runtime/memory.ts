/**
 * In-memory runtime adapter — supports the full multi-cycle agent with NO
 * Supabase. Used for development and tests. Never pretends data is permanent:
 * every write records databaseWriteDeferred semantics via the caller. For tests
 * it additionally exposes a deterministic clock so scheduled events can be fired
 * by advancing virtual time.
 *
 * Loop-safety present here: idempotency-key dedup, goal-level processing lock
 * (setGoalLock/getGoalLock), scheduled-event cancel, and stale detection helpers.
 */
import type {
  AgentGoal,
  AgentEvent,
  AgentRun,
  AgentCycle,
  ScheduledAgentEvent,
  AgentEventProcessingStatus,
} from "./types.ts";
import type {
  AgentRuntimeRepositories,
  GoalRepository,
  EventRepository,
  RunRepository,
  CycleRepository,
  ActionRepository,
  AgentActionRecord,
  SchedulerRepository,
} from "./repositories.ts";
import { createMemoryRepositories } from "../adapters/memory.ts";
import { createRuntime } from "./engine.ts";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export class MemoryGoalRepository implements GoalRepository {
  private goals = new Map<string, AgentGoal>();
  private locks = new Map<string, string>(); // goalId -> runId holding lock

  async create(g: AgentGoal): Promise<AgentGoal> {
    this.goals.set(g.id, { ...g });
    return { ...g };
  }
  async update(id: string, patch: Partial<AgentGoal>): Promise<AgentGoal> {
    const cur = this.goals.get(id);
    if (!cur) throw new Error(`Goal ${id} not found`);
    const next = { ...cur, ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() };
    this.goals.set(id, next);
    return { ...next };
  }
  async get(id: string): Promise<AgentGoal | null> {
    const g = this.goals.get(id);
    return g ? { ...g } : null;
  }
  async getActiveForConversation(resortId: string, conversationId: string): Promise<AgentGoal | null> {
    for (const g of this.goals.values()) {
      if (g.resortId === resortId && g.conversationId === conversationId && g.status !== "completed" && g.status !== "cancelled" && g.status !== "lost" && g.status !== "escalated") {
        return { ...g };
      }
    }
    return null;
  }
  async listStale(resortId: string, before: string): Promise<AgentGoal[]> {
    const out: AgentGoal[] = [];
    for (const g of this.goals.values()) {
      if (g.resortId === resortId && g.staleAt && g.staleAt <= before) out.push({ ...g });
    }
    return out;
  }
  // Lock helpers.
  tryLock(goalId: string, runId: string): boolean {
    const existing = this.locks.get(goalId);
    if (existing && existing !== runId) return false;
    this.locks.set(goalId, runId);
    return true;
  }
  unlock(goalId: string, runId: string): void {
    if (this.locks.get(goalId) === runId) this.locks.delete(goalId);
  }
}

export class MemoryEventRepository implements EventRepository {
  private events = new Map<string, AgentEvent>();
  async create(ev: AgentEvent): Promise<AgentEvent> {
    // Idempotency: skip duplicate key.
    for (const e of this.events.values()) {
      if (e.resortId === ev.resortId && e.idempotencyKey === ev.idempotencyKey) return { ...e };
    }
    this.events.set(ev.id, { ...ev });
    return { ...ev };
  }
  async markProcessed(id: string, status: AgentEventProcessingStatus): Promise<void> {
    const e = this.events.get(id);
    if (e) this.events.set(id, { ...e, processingStatus: status, processedAt: new Date().toISOString() });
  }
  async getByProcessingStatus(resortId: string, status: string): Promise<AgentEvent[]> {
    return [...this.events.values()].filter((e) => e.resortId === resortId && e.processingStatus === status).map((e) => ({ ...e }));
  }
  async getByGoal(goalId: string): Promise<AgentEvent[]> {
    return [...this.events.values()].filter((e) => e.goalId === goalId).map((e) => ({ ...e }));
  }
}

export class MemoryRunRepository implements RunRepository {
  private runs = new Map<string, AgentRun>();
  async create(r: AgentRun): Promise<AgentRun> {
    this.runs.set(r.id, { ...r, cycles: [...r.cycles] });
    return { ...r, cycles: [...r.cycles] };
  }
  async addCycle(runId: string, cycleId: string): Promise<void> {
    const r = this.runs.get(runId);
    if (r) this.runs.set(runId, { ...r, cycles: [...r.cycles, cycleId] });
  }
  async get(runId: string): Promise<AgentRun | null> {
    const r = this.runs.get(runId);
    return r ? { ...r, cycles: [...r.cycles] } : null;
  }
}

export class MemoryCycleRepository implements CycleRepository {
  private cycles = new Map<string, AgentCycle>();
  async create(c: AgentCycle): Promise<AgentCycle> {
    this.cycles.set(c.id, { ...c });
    return { ...c };
  }
  async update(id: string, patch: Partial<AgentCycle>): Promise<AgentCycle> {
    const cur = this.cycles.get(id);
    if (!cur) throw new Error(`Cycle ${id} not found`);
    const next = { ...cur, ...patch };
    this.cycles.set(id, next);
    return { ...next };
  }
  async get(id: string): Promise<AgentCycle | null> {
    const c = this.cycles.get(id);
    return c ? { ...c } : null;
  }
  async listByGoal(goalId: string): Promise<AgentCycle[]> {
    return [...this.cycles.values()].filter((c) => c.goalId === goalId).map((c) => ({ ...c }));
  }
}

export class MemoryActionRepository implements ActionRepository {
  private actions = new Map<string, AgentActionRecord>();
  async create(a: AgentActionRecord): Promise<AgentActionRecord> {
    this.actions.set(a.id, { ...a });
    return { ...a };
  }
  async update(id: string, patch: Partial<AgentActionRecord>): Promise<AgentActionRecord> {
    const cur = this.actions.get(id);
    if (!cur) throw new Error(`Action ${id} not found`);
    const next = { ...cur, ...patch };
    this.actions.set(id, next);
    return { ...next };
  }
  async get(id: string): Promise<AgentActionRecord | null> {
    const a = this.actions.get(id);
    return a ? { ...a } : null;
  }
}

export class MemorySchedulerRepository implements SchedulerRepository {
  private events = new Map<string, ScheduledAgentEvent>();
  async schedule(ev: ScheduledAgentEvent): Promise<void> {
    // Abort if a non-cancelled event of same type+goal already exists.
    for (const e of this.events.values()) {
      if (!e.cancelled && e.goalId === ev.goalId && e.eventType === ev.eventType) return;
    }
    this.events.set(ev.id, { ...ev });
  }
  async cancel(eventId: string): Promise<void> {
    const e = this.events.get(eventId);
    if (e) this.events.set(eventId, { ...e, cancelled: true });
  }
  async getDue(resortId: string, now: string): Promise<ScheduledAgentEvent[]> {
    return [...this.events.values()].filter((e) => !e.cancelled && e.resortId === resortId && e.dueAt <= now).map((e) => ({ ...e }));
  }
  async getByGoal(goalId: string): Promise<ScheduledAgentEvent[]> {
    return [...this.events.values()].filter((e) => e.goalId === goalId).map((e) => ({ ...e }));
  }
}

export interface MemoryRuntimeAdapter extends AgentRuntimeRepositories {
  __goals: MemoryGoalRepository;
  __events: MemoryEventRepository;
  __runs: MemoryRunRepository;
  __cycles: MemoryCycleRepository;
  __actions: MemoryActionRepository;
  __scheduler: MemorySchedulerRepository;
  /** Operation repos (also used by tools/registry). */
  leads: import("../adapters/repositories.ts").LeadRepository;
  rateRequests: import("../adapters/repositories.ts").RateRequestRepository;
  approvals: import("../adapters/repositories.ts").ApprovalRepository;
  activity: import("../adapters/repositories.ts").ActivityRepository;
  /** Deterministic time advance for tests: fire all due events <= now. */
  advanceTime(now: string): Promise<ScheduledAgentEvent[]>;
}

export function createMemoryRuntime(): MemoryRuntimeAdapter {
  const __goals = new MemoryGoalRepository();
  const __events = new MemoryEventRepository();
  const __runs = new MemoryRunRepository();
  const __cycles = new MemoryCycleRepository();
  const __actions = new MemoryActionRepository();
  const __scheduler = new MemorySchedulerRepository();
  // Operation repos the tools use (leads, rateRequests, approvals, activity).
  const ops = createMemoryRepositories();
  const adapter: MemoryRuntimeAdapter = {
    goals: __goals,
    events: __events,
    runs: __runs,
    cycles: __cycles,
    actions: __actions,
    scheduler: __scheduler,
    leads: ops.leads,
    rateRequests: ops.rateRequests,
    approvals: ops.approvals,
    activity: ops.activity,
    __goals,
    __events,
    __runs,
    __cycles,
    __actions,
    __scheduler,
    async advanceTime(now: string) {
      // Test helper: return every non-cancelled scheduled event due <= now,
      // across all resorts, so a test can deterministically fire them.
      return [...__scheduler["events"].values()]
        .filter((e) => !e.cancelled && e.dueAt <= now)
        .map((e) => ({ ...e }));
    },
  };
  // Wrap as a proper AgentRuntime (nested .repos) so submitEvent/runAgentCycle
  // can use it uniformly with the Supabase adapter.
  return createRuntime(adapter, { persistent: false }) as unknown as MemoryRuntimeAdapter;
}
