/**
 * Approval resume — when approval_granted arrives, reload the same goal, verify
 * the approval scope, resume EXACTLY the paused action, execute it, verify, and
 * continue the goal. Rejection replans or escalates. An approval for one draft
 * must NOT authorize a different action.
 */
import type { AgentRuntime } from "./engine.ts";
import { runAgentCycle, scopeKey } from "./engine.ts";
import type { AgentEvent, AgentGoal, AgentRuntimeConfig } from "./types.ts";
import { uid } from "./engine.ts";

function nowIso(): string {
  return new Date().toISOString();
}

export async function resumeAfterApproval(
  rt: AgentRuntime,
  approvalId: string,
  event: Omit<AgentEvent, "id" | "processingStatus" | "createdAt" | "processedAt"> & { id?: string },
): Promise<{ event: AgentEvent; cycle?: Awaited<ReturnType<typeof runAgentCycle>>["cycle"]; reply: string }> {
  // Load the approval to verify scope.
  const ap = await rt.repos.approvals.get?.(approvalId);
  if (!ap || ap.status !== "pending") {
    const e = await rt.repos.events.create({ ...toEvent(event, uid("evt")), idempotencyKey: event.idempotencyKey });
    return { event: e, reply: "" };
  }
  // Mark approval granted and scope-bound to its exact actionType/draft.
  await rt.repos.approvals.update?.(approvalId, { status: "approved", decidedBy: "owner", decidedAt: nowIso() } as any);

  // Load the goal up front.
  const goal = ap.goalId ? await rt.repos.goals.get(ap.goalId) : null;
  if (!goal) throw new Error("goal missing for approval resume");

  // Record the approved action on the goal so the resume cycle executes it
  // directly instead of re-requesting approval (scope-bound by tool+draft).
  {
    const key = scopeKey(ap.actionType, JSON.parse(ap.draftContent || "{}"));
    const existing = goal.approvedActions ?? [];
    if (!existing.includes(key)) {
      await rt.repos.goals.update(goal.id, { approvedActions: [...existing, key] });
    }
  }
  // We directly continue: set the goal active and run a cycle that executes the
  // previously-paused tool now that approval exists. We encode approval in the
  // event so the engine knows to skip re-requesting it.
  const resumeEvent: AgentEvent = {
    id: event.id ?? uid("evt"),
    resortId: event.resortId,
    goalId: ap.goalId!,
    conversationId: event.conversationId,
    leadId: event.leadId ?? ap.leadId,
    type: "approval_granted",
    payload: { ...event.payload, approvedAction: ap.actionType, approvedDraft: ap.draftContent },
    source: "admin",
    idempotencyKey: event.idempotencyKey,
    processingStatus: "pending",
    createdAt: nowIso(),
  };
  await rt.repos.events.create(resumeEvent);
  const runId = uid("run");
  await rt.repos.runs.create({ id: runId, resortId: event.resortId, goalId: ap.goalId!, cycles: [], startedAt: nowIso() });
  const { cycle, reply } = await runAgentCycle(rt, resumeEvent, runId);
  await rt.repos.events.markProcessed(resumeEvent.id, "processed");
  return { event: resumeEvent, cycle, reply };
}

export async function replanAfterRejection(
  rt: AgentRuntime,
  approvalId: string,
  event: Omit<AgentEvent, "id" | "processingStatus" | "createdAt" | "processedAt"> & { id?: string },
): Promise<{ event: AgentEvent; reply: string }> {
  const ap = await rt.repos.approvals.get?.(approvalId);
  if (ap) await rt.repos.approvals.update?.(approvalId, { status: "rejected", decidedBy: "owner", decidedAt: nowIso() } as any);
  const goal = ap?.goalId ? await rt.repos.goals.get(ap.goalId) : null;
  let reply = "Thank you — our team will follow up with you directly on this.";
  if (goal) {
    // Escalate to human rather than retry autonomously.
    await rt.repos.goals.update(goal.id, { status: "escalated", blockers: [...goal.blockers, "approval rejected"] });
    reply = "I've asked our team to take it from here and they'll reach out to you.";
  }
  const e = await rt.repos.events.create({ ...toEvent(event, uid("evt")), idempotencyKey: event.idempotencyKey });
  return { event: e, reply };
}

function toEvent(e: Omit<AgentEvent, "id" | "processingStatus" | "createdAt" | "processedAt">, id: string): AgentEvent {
  return {
    id,
    resortId: e.resortId,
    goalId: e.goalId,
    conversationId: e.conversationId,
    leadId: e.leadId,
    type: e.type,
    payload: e.payload,
    source: e.source,
    idempotencyKey: e.idempotencyKey,
    processingStatus: "pending",
    createdAt: nowIso(),
  };
}
