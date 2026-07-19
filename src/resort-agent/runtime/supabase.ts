/**
 * Supabase runtime adapter — IMPLEMENTED but DISABLED until the owner confirms
 * supabase/manual_sql/002_agent_runtime.sql ran in Lovable.dev. Selectable only
 * via RESORT_AGENT_PERSISTENCE=supabase AND markSupabaseRuntimeConfirmed().
 *
 * Maps runtime records onto the SQL tables:
 *   agent_goals, agent_events, agent_runs, agent_cycles, agent_actions,
 *   scheduled_agent_events (plus the operation tables from adapters/supabase.ts).
 *
 * Uses the server-only Supabase admin client. The browser must never import this.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AgentRuntimeRepositories } from "./repositories";
import type {
  AgentGoal,
  AgentEvent,
  AgentRun,
  AgentCycle,
  ScheduledAgentEvent,
  AgentActionRecord,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export class SupabaseGoalRepository {
  async create(g: AgentGoal): Promise<AgentGoal> {
    const { data, error } = await supabaseAdmin.from("agent_goals").insert(rowFromGoal(g)).select().single();
    if (error) throw error;
    return goalFromRow(data);
  }
  async update(id: string, patch: Partial<AgentGoal>): Promise<AgentGoal> {
    const { data, error } = await supabaseAdmin.from("agent_goals").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return goalFromRow(data);
  }
  async get(id: string): Promise<AgentGoal | null> {
    const { data } = await supabaseAdmin.from("agent_goals").select("*").eq("id", id).maybeSingle();
    return data ? goalFromRow(data) : null;
  }
  async getActiveForConversation(resortId: string, conversationId: string): Promise<AgentGoal | null> {
    const { data } = await supabaseAdmin
      .from("agent_goals")
      .select("*")
      .eq("resort_id", resortId)
      .eq("conversation_id", conversationId)
      .in("status", ["active", "waiting_for_guest", "waiting_for_approval", "waiting_for_time", "blocked"])
      .maybeSingle();
    return data ? goalFromRow(data) : null;
  }
  async listStale(resortId: string, before: string): Promise<AgentGoal[]> {
    const { data } = await supabaseAdmin.from("agent_goals").select("*").eq("resort_id", resortId).lte("stale_at", before);
    return (data ?? []).map(goalFromRow);
  }
}

export class SupabaseEventRepository {
  async create(ev: AgentEvent): Promise<AgentEvent> {
    const { data, error } = await supabaseAdmin.from("agent_events").insert(rowFromEvent(ev)).select().single();
    if (error) throw error;
    return eventFromRow(data);
  }
  async markProcessed(id: string, status: string): Promise<void> {
    await supabaseAdmin.from("agent_events").update({ processing_status: status, processed_at: new Date().toISOString() }).eq("id", id);
  }
  async getByProcessingStatus(resortId: string, status: string): Promise<AgentEvent[]> {
    const { data } = await supabaseAdmin.from("agent_events").select("*").eq("resort_id", resortId).eq("processing_status", status);
    return (data ?? []).map(eventFromRow);
  }
  async getByGoal(goalId: string): Promise<AgentEvent[]> {
    const { data } = await supabaseAdmin.from("agent_events").select("*").eq("goal_id", goalId);
    return (data ?? []).map(eventFromRow);
  }
}

export class SupabaseRunRepository {
  async create(r: AgentRun): Promise<AgentRun> {
    const { data, error } = await supabaseAdmin.from("agent_runs").insert({ id: r.id, resort_id: r.resortId, goal_id: r.goalId, cycles: [], started_at: r.startedAt }).select().single();
    if (error) throw error;
    return { ...r, cycles: data.cycles ?? [] };
  }
  async addCycle(runId: string, cycleId: string): Promise<void> {
    const { data } = await supabaseAdmin.from("agent_runs").select("cycles").eq("id", runId).single();
    const cycles: string[] = [...(data?.cycles ?? []), cycleId];
    await supabaseAdmin.from("agent_runs").update({ cycles }).eq("id", runId);
  }
  async get(runId: string): Promise<AgentRun | null> {
    const { data } = await supabaseAdmin.from("agent_runs").select("*").eq("id", runId).maybeSingle();
    return data ? { id: data.id, resortId: data.resort_id, goalId: data.goal_id, cycles: data.cycles ?? [], startedAt: data.started_at, finishedAt: data.finished_at } : null;
  }
}

export class SupabaseCycleRepository {
  async create(c: AgentCycle): Promise<AgentCycle> {
    const { data, error } = await supabaseAdmin.from("agent_cycles").insert(rowFromCycle(c)).select().single();
    if (error) throw error;
    return cycleFromRow(data);
  }
  async update(id: string, patch: Partial<AgentCycle>): Promise<AgentCycle> {
    const { data, error } = await supabaseAdmin.from("agent_cycles").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return cycleFromRow(data);
  }
  async get(id: string): Promise<AgentCycle | null> {
    const { data } = await supabaseAdmin.from("agent_cycles").select("*").eq("id", id).maybeSingle();
    return data ? cycleFromRow(data) : null;
  }
  async listByGoal(goalId: string): Promise<AgentCycle[]> {
    const { data } = await supabaseAdmin.from("agent_cycles").select("*").eq("goal_id", goalId);
    return (data ?? []).map(cycleFromRow);
  }
}

export class SupabaseActionRepository {
  async create(a: AgentActionRecord): Promise<AgentActionRecord> {
    const { data, error } = await supabaseAdmin.from("agent_actions").insert({ ...a, resort_id: a.resortId, goal_id: a.goalId, cycle_id: a.cycleId }).select().single();
    if (error) throw error;
    return data as AgentActionRecord;
  }
  async update(id: string, patch: Partial<AgentActionRecord>): Promise<AgentActionRecord> {
    const { data, error } = await supabaseAdmin.from("agent_actions").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return data as AgentActionRecord;
  }
  async get(id: string): Promise<AgentActionRecord | null> {
    const { data } = await supabaseAdmin.from("agent_actions").select("*").eq("id", id).maybeSingle();
    return (data as AgentActionRecord) ?? null;
  }
}

export class SupabaseSchedulerRepository {
  async schedule(ev: ScheduledAgentEvent): Promise<void> {
    await supabaseAdmin.from("scheduled_agent_events").insert({
      id: ev.id, resort_id: ev.resortId, goal_id: ev.goalId, lead_id: ev.leadId,
      event_type: ev.eventType, payload: ev.payload, due_at: ev.dueAt, created_at: ev.createdAt,
    });
  }
  async cancel(eventId: string): Promise<void> {
    await supabaseAdmin.from("scheduled_agent_events").update({ cancelled: true }).eq("id", eventId);
  }
  async getDue(resortId: string, now: string): Promise<ScheduledAgentEvent[]> {
    const { data } = await supabaseAdmin.from("scheduled_agent_events").select("*").eq("resort_id", resortId).lte("due_at", now).eq("cancelled", false);
    return (data ?? []).map(schedFromRow);
  }
  async getByGoal(goalId: string): Promise<ScheduledAgentEvent[]> {
    const { data } = await supabaseAdmin.from("scheduled_agent_events").select("*").eq("goal_id", goalId);
    return (data ?? []).map(schedFromRow);
  }
}

function rowFromGoal(g: AgentGoal) {
  return {
    id: g.id, resort_id: g.resortId, conversation_id: g.conversationId, lead_id: g.leadId,
    goal_type: g.goalType, objective: g.objective, status: g.status, success_criteria: g.successCriteria,
    blockers: g.blockers, missing_information: g.missingInformation, current_step: g.currentStep,
    next_review_at: g.nextReviewAt, cycle_count: g.cycleCount, last_processed_at: g.lastProcessedAt,
    stale_at: g.staleAt, approved_actions: g.approvedActions ?? [], state: g.state ?? {}, created_at: g.createdAt,
    updated_at: g.updatedAt, completed_at: g.completedAt,
  };
}
function goalFromRow(r: any): AgentGoal {
  return {
    id: r.id, resortId: r.resort_id, conversationId: r.conversation_id, leadId: r.lead_id, goalType: r.goal_type,
    objective: r.objective, status: r.status, successCriteria: r.success_criteria ?? [], blockers: r.blockers ?? [],
    missingInformation: r.missing_information ?? [], currentStep: r.current_step, nextReviewAt: r.next_review_at,
    cycleCount: r.cycle_count ?? 0, lastProcessedAt: r.last_processed_at, staleAt: r.stale_at,
    approvedActions: r.approved_actions ?? [], state: r.state ?? {}, createdAt: r.created_at, updatedAt: r.updated_at,
    completedAt: r.completed_at,
  };
}
function rowFromEvent(e: AgentEvent) {
  return {
    id: e.id, resort_id: e.resortId, goal_id: e.goalId, conversation_id: e.conversationId, lead_id: e.leadId,
    type: e.type, payload: e.payload, source: e.source, idempotency_key: e.idempotencyKey,
    processing_status: e.processingStatus, created_at: e.createdAt, processed_at: e.processedAt,
  };
}
function eventFromRow(r: any): AgentEvent {
  return {
    id: r.id, resortId: r.resort_id, goalId: r.goal_id, conversationId: r.conversation_id, leadId: r.lead_id,
    type: r.type, payload: r.payload ?? {}, source: r.source, idempotencyKey: r.idempotency_key,
    processingStatus: r.processing_status, createdAt: r.created_at, processedAt: r.processed_at,
  };
}
function rowFromCycle(c: AgentCycle) {
  return {
    id: c.id, resort_id: c.resortId, goal_id: c.goalId, run_id: c.runId, trigger_event_id: c.triggerEventId,
    goal_snapshot: c.goalSnapshot, knowledge_used: c.knowledgeUsed, plan: c.plan, actions_attempted: c.actionsAttempted,
    actions_completed: c.actionsCompleted, approval_requests_created: c.approvalRequestsCreated, errors: c.errors,
    verification_result: c.verificationResult, next_scheduled_event_id: c.nextScheduledEventId, status: c.status,
    started_at: c.startedAt, finished_at: c.finishedAt,
  };
}
function cycleFromRow(r: any): AgentCycle {
  return {
    id: r.id, resortId: r.resort_id, goalId: r.goal_id, runId: r.run_id, triggerEventId: r.trigger_event_id,
    goalSnapshot: r.goal_snapshot, knowledgeUsed: r.knowledge_used, plan: r.plan, actionsAttempted: r.actions_attempted ?? [],
    actionsCompleted: r.actions_completed ?? [], approvalRequestsCreated: r.approval_requests_created ?? [], errors: r.errors ?? [],
    verificationResult: r.verification_result, nextScheduledEventId: r.next_scheduled_event_id, status: r.status,
    startedAt: r.started_at, finishedAt: r.finished_at,
  };
}
function schedFromRow(r: any): ScheduledAgentEvent {
  return {
    id: r.id, resortId: r.resort_id, goalId: r.goal_id, leadId: r.lead_id, eventType: r.event_type,
    payload: r.payload ?? {}, dueAt: r.due_at, createdAt: r.created_at, cancelled: r.cancelled,
  };
}

export function createSupabaseRuntimeRepositories(): AgentRuntimeRepositories {
  return {
    goals: new SupabaseGoalRepository() as any,
    events: new SupabaseEventRepository() as any,
    runs: new SupabaseRunRepository() as any,
    cycles: new SupabaseCycleRepository() as any,
    actions: new SupabaseActionRepository() as any,
    scheduler: new SupabaseSchedulerRepository() as any,
  };
}
