/**
 * Autonomous agent runtime — the persistent, event-driven engine.
 *
 *   runAgentCycle(trigger event)
 *   -> load goal and state
 *   -> observe current evidence
 *   -> evaluate blockers (loop-safety)
 *   -> generate a constrained plan
 *   -> execute allowed actions (pause on approval_required)
 *   -> request approval where required
 *   -> persist results
 *   -> schedule the next event
 *   -> verify outcomes
 *   -> continue or pause
 *
 * The agent maintains an ACTIVE GOAL across cycles. The single-cycle
 * runResortAgent() is a thin compatibility wrapper that creates a guest event
 * and calls this. No prices, no availability confirmation, no external send.
 *
 * Source attribution: orchestration loop concept ported from Onyx
 * skills/builtin/resort-agent (MIT) and extended with multi-cycle state,
 * approval pause/resume, scheduling, and verification per the governing spec.
 */
import type {
  AgentGoal,
  AgentEvent,
  AgentGoalStatus,
  AgentGoalType,
  AgentPlan,
  AgentCycle,
  AgentCycleStatus,
  ScheduledAgentEvent,
  AgentRuntimeConfig,
} from "./types.ts";
import { DEFAULT_RUNTIME_CONFIG } from "./types.ts";
import type { AgentRuntimeRepositories } from "./repositories.ts";
import { MemoryGoalRepository } from "./memory.ts";
import { buildPlan, goalTypeForMessage } from "./planner.ts";
import { LoopSafety } from "./safety.ts";
import { getTool } from "./tools/index.ts";
import { resumeAfterApproval, replanAfterRejection } from "./approval.ts";
import { classifyIntent } from "../core/intent.ts";
import { extractDetails, validateDetails } from "../qualification/qualification.ts";
import { scanForMoney } from "../../baia/concierge.guardrails.ts";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}
function nowIso(): string {
  return new Date().toISOString();
}
export { uid, nowIso };

/** Approval scope key: identifies an action uniquely but ignores runtime-assigned leadId. */
export function scopeKey(toolName: string, input: unknown): string {
  const copy = input && typeof input === "object" ? { ...(input as Record<string, unknown>) } : input;
  if (copy && typeof copy === "object") delete (copy as Record<string, unknown>).leadId;
  return `${toolName}:${JSON.stringify(copy)}`;
}

export interface AgentRuntime {
  repos: AgentRuntimeRepositories;
  safety: LoopSafety;
  cfg: AgentRuntimeConfig;
  persistent: boolean;
}

export function createRuntime(
  repos: AgentRuntimeRepositories,
  opts: { cfg?: AgentRuntimeConfig; persistent?: boolean } = {},
): AgentRuntime {
  return {
    repos,
    safety: new LoopSafety(opts.cfg ?? DEFAULT_RUNTIME_CONFIG),
    cfg: opts.cfg ?? DEFAULT_RUNTIME_CONFIG,
    persistent: opts.persistent ?? false,
  };
}

/** Submit an external/internal event and run a cycle for it (idempotent). */
export async function submitEvent(
  rt: AgentRuntime,
  ev: Omit<AgentEvent, "id" | "processingStatus" | "createdAt" | "processedAt"> & { id?: string },
): Promise<{ event: AgentEvent; cycle?: AgentCycle; reply: string }> {
  const event: AgentEvent = {
    id: ev.id ?? uid("evt"),
    resortId: ev.resortId,
    goalId: ev.goalId,
    conversationId: ev.conversationId,
    leadId: ev.leadId,
    type: ev.type,
    payload: ev.payload,
    source: ev.source,
    idempotencyKey: ev.idempotencyKey,
    processingStatus: "pending",
    createdAt: nowIso(),
  };
  // Idempotency: if an event with this key was already processed, skip.
  const existing = await rt.repos.events.getByProcessingStatus(event.resortId, "processed");
  if (existing.some((e) => e.idempotencyKey === event.idempotencyKey)) {
    return { event: { ...event, processingStatus: "skipped" }, reply: "" };
  }
  await rt.repos.events.create(event);
  await rt.repos.events.markProcessed(event.id, "processing");

  // Route approval lifecycle events to the dedicated handlers.
  if (event.type === "approval_granted") {
    const apId = String(event.payload.approvalId ?? "");
    if (!apId) throw new Error("approval_granted requires payload.approvalId");
    const { event: e2, cycle, reply } = await resumeAfterApproval(rt, apId, event);
    await rt.repos.events.markProcessed(event.id, "processed");
    return { event: e2, cycle, reply };
  }
  if (event.type === "approval_rejected") {
    const apId = String(event.payload.approvalId ?? "");
    if (!apId) throw new Error("approval_rejected requires payload.approvalId");
    const { event: e2, reply } = await replanAfterRejection(rt, apId, event);
    await rt.repos.events.markProcessed(event.id, "processed");
    return { event: e2, reply };
  }

  // Terminal events (Flow F): booking confirmed/declined close the goal.
  if (event.type === "booking_confirmed") {
    const goalId = event.goalId;
    if (goalId) {
      const g = await rt.repos.goals.get(goalId);
      if (g) {
        await rt.repos.goals.update(goalId, { status: "completed", completedAt: nowIso() });
        // Cancel pending follow-ups.
        const evs = await rt.repos.scheduler.getByGoal(goalId);
        for (const e of evs) if (!e.cancelled) await rt.repos.scheduler.cancel(e.id);
      }
    }
    await rt.repos.events.create(event);
    await rt.repos.events.markProcessed(event.id, "processed");
    return {
      event,
      reply: "Thank you — your booking is confirmed. We look forward to welcoming you!",
    };
  }
  if (event.type === "booking_declined" || event.type === "goal_cancelled") {
    const goalId = event.goalId;
    if (goalId) await rt.repos.goals.update(goalId, { status: "lost", completedAt: nowIso() });
    await rt.repos.events.create(event);
    await rt.repos.events.markProcessed(event.id, "processed");
    return { event, reply: "" };
  }

  const runId = uid("run");
  await rt.repos.runs.create({ id: runId, resortId: event.resortId, goalId: event.goalId ?? "none", cycles: [], startedAt: nowIso() });

  const { cycle, reply } = await runAgentCycle(rt, event, runId);
  await rt.repos.events.markProcessed(event.id, "processed");
  return { event, cycle, reply };
}

/** The core cycle. */
export async function runAgentCycle(
  rt: AgentRuntime,
  event: AgentEvent,
  runId: string,
): Promise<{ cycle?: AgentCycle; reply: string }> {
  const now = nowIso();

  // 1. Load goal (resume existing or create new).
  let goal: AgentGoal | null =
    event.goalId
      ? await rt.repos.goals.get(event.goalId)
      : await rt.repos.goals.getActiveForConversation(event.resortId, event.conversationId ?? "");

  if (!goal) {
    goal = await createGoalForEvent(rt, event, now);
  }

  // 2. Goal-level processing lock (prevent concurrent processing).
  if (rt.repos.goals instanceof MemoryGoalRepository) {
    const locked = (rt.repos.goals as MemoryGoalRepository).tryLock(goal.id, runId);
    if (!locked) {
      return { cycle: undefined, reply: "" }; // another run holds the lock
    }
  }

  // 3. Loop-safety: stale / cycle budget.
  if (rt.safety.isStale(goal, now)) {
    goal = await rt.repos.goals.update(goal.id, { status: "lost", completedAt: now });
    return { cycle: undefined, reply: "This conversation has been closed due to inactivity. Please start a new inquiry and we'll be glad to help." };
  }
  const budget = rt.safety.checkCycleBudget(goal, now);
  if (!budget.ok) {
    goal = await rt.repos.goals.update(goal.id, { status: "escalated", blockers: [...goal.blockers, budget.reason ?? "limit"] });
    return { cycle: undefined, reply: "Our team has been notified to take over this request." };
  }

  // 4. Observe: extract details from message if present.
  const message = (event.payload.message as string) ?? undefined;
  let details: Record<string, unknown> = {};
  if (message) details = validateDetails(extractDetails(message, {}));

  // 5. Plan (constrained, deterministic policy).
  const { plan, reply } = buildPlan({ resortId: event.resortId, goal, message, lastReply: goal.currentStep, now });

  // 6. Create the cycle record (proof of observe/decide/act/verify).
  const cycleId = uid("cyc");
  const cycle: AgentCycle = {
    id: cycleId,
    resortId: event.resortId,
    goalId: goal.id,
    runId,
    triggerEventId: event.id,
    goalSnapshot: { ...goal },
    plan,
    actionsAttempted: [],
    actionsCompleted: [],
    approvalRequestsCreated: [],
    errors: [],
    status: "running",
    startedAt: now,
  };
  await rt.repos.cycles.create(cycle);
  await rt.repos.runs.addCycle(runId, cycleId);

  // 7. Execute actions until we must pause for approval or hit a limit.
  let pausedForApproval = false;
  let ctxLeadId = goal.leadId;
  let finalReply = reply;
  const errors: string[] = [];
  let actionCount = 0;

  for (const pa of plan.actions) {
    const actionBudget = rt.safety.checkActionBudget(actionCount);
    if (!actionBudget.ok) {
      errors.push(actionBudget.reason ?? "action limit");
      break;
    }
    const tool = getTool(pa.toolName);
    if (!tool) {
      errors.push(`unknown tool ${pa.toolName}`);
      continue;
    }
    const validation = tool.validate(pa.input, makeCtx(rt, goal, cycle, ctxLeadId, finalReply, now));
    if (!validation.ok) {
      errors.push(`${pa.toolName}: ${validation.error}`);
      continue;
    }

    const actionKey = scopeKey(pa.toolName, pa.input);
    const alreadyApproved = (goal.approvedActions ?? []).includes(actionKey);
    if ((pa.requiresApproval || tool.actionLevel === "approval_required") && !alreadyApproved) {
      // Create the approval request scoped to this exact action/draft.
      const ap = await rt.repos.approvals.create({
        resortId: event.resortId,
        goalId: goal.id,
        leadId: ctxLeadId,
        conversationId: event.conversationId,
        actionType: pa.toolName,
        draftContent: JSON.stringify(pa.input),
        riskLevel: "high",
        status: "pending",
      });
      cycle.approvalRequestsCreated.push(ap.id);
      pausedForApproval = true;
      // Stop executing further actions this cycle; wait for approval_granted.
      goal = await rt.repos.goals.update(goal.id, {
        status: "waiting_for_approval",
        currentStep: pa.toolName,
        missingInformation: [],
      });
      break;
    }

    // Execute (with retry semantics).
    const execResult = await executeWithRetry(rt, tool, pa.input, makeCtx(rt, goal, cycle, ctxLeadId, finalReply, now));
    const actionId = uid("act");
    const stored = await rt.repos.actions.create({
      id: actionId,
      resortId: event.resortId,
      goalId: goal.id,
      cycleId,
      toolName: pa.toolName,
      status: execResult.ok ? "succeeded" : "failed",
      output: execResult.output,
      error: execResult.error,
      retryable: execResult.retryable,
      attempt: 1,
      createdAt: now,
    });
    cycle.actionsAttempted.push(actionId);
    if (execResult.ok) {
      cycle.actionsCompleted.push(actionId);
      if (execResult.output?.leadId) ctxLeadId = String(execResult.output.leadId);
      if (execResult.output?.reply) finalReply = String(execResult.output.reply);
      // Persist collected details onto the goal state for resume continuity.
      if (pa.toolName === "create_or_update_lead" && ctxLeadId) {
        const lead = await rt.repos.leads.get?.(ctxLeadId);
        if (lead) {
          const st: Record<string, unknown> = {
            ...(goal.state ?? {}),
            checkIn: lead.checkIn,
            checkOut: lead.checkOut,
            adults: lead.guestCount,
            children: lead.childrenCount,
            roomPreference: lead.roomPreference,
            transportNeeded: lead.transportNeeded,
          };
          goal = await rt.repos.goals.update(goal.id, { state: st });
        }
      }
      // Verify if the tool supports it.
      if (tool.verify) {
        const v = await tool.verify(execResult, makeCtx(rt, goal, cycle, ctxLeadId, finalReply, now));
        if (!v.verified) errors.push(`${pa.toolName} verify: ${v.notes}`);
      }
    } else {
      errors.push(`${pa.toolName}: ${execResult.error}`);
      // Retry scheduling (loop-safety bounded). Count attempts so repeated
      // failure escalates to a human instead of looping forever.
      if (execResult.retryable) {
        const prevAttempt = Number((event.payload as Record<string, unknown>).attempt ?? 0);
        const nextAttempt = prevAttempt + 1;
        if (rt.safety.retriesExhausted(nextAttempt)) {
          // Give up autonomously; escalate to staff (fail closed).
          goal = await rt.repos.goals.update(goal.id, {
            status: "escalated",
            blockers: [...goal.blockers, `action ${pa.toolName} failed after ${nextAttempt} retries`],
          });
          pausedForApproval = false;
        } else {
          const retryDue = new Date(Date.parse(now) + rt.safety.shouldRetry(nextAttempt).delayMs).toISOString();
          await rt.repos.scheduler.schedule({
            id: uid("sched"),
            resortId: event.resortId,
            goalId: goal.id,
            leadId: ctxLeadId,
            eventType: "retry",
            payload: { actionId, toolName: pa.toolName, input: pa.input, attempt: nextAttempt },
            dueAt: retryDue,
            createdAt: now,
          });
          goal = await rt.repos.goals.update(goal.id, { status: "waiting_for_time" });
          pausedForApproval = false;
        }
      }
    }
    actionCount++;
  }

  // 8. If the goal moved to waiting_for_approval, schedule no further event;
  //    the approval_granted handler will resume.
  let nextScheduledEventId: string | undefined;
  if (!pausedForApproval) {
    // Persist lead id back onto the goal.
    if (ctxLeadId && !goal.leadId) {
      goal = await rt.repos.goals.update(goal.id, { leadId: ctxLeadId });
    }
    // Apply the plan's next state.
    const nextState = plan.nextState;
    goal = await rt.repos.goals.update(goal.id, {
      status: nextState,
      currentStep: finalReply,
      cycleCount: goal.cycleCount + 1,
      lastProcessedAt: now,
      staleAt: new Date(Date.parse(now) + rt.cfg.goalStaleMs).toISOString(),
    });
    // Schedule a goal review as a safety net.
    const reviewEv: ScheduledAgentEvent = {
      id: uid("sched"),
      resortId: event.resortId,
      goalId: goal.id,
      leadId: ctxLeadId,
      eventType: "goal_review",
      payload: {},
      dueAt: new Date(Date.parse(now) + rt.cfg.goalStaleMs).toISOString(),
      createdAt: now,
    };
    await rt.repos.scheduler.schedule(reviewEv);
    nextScheduledEventId = reviewEv.id;
  }

  // 9. Finalize cycle.
  const verification = {
    verified: errors.length === 0,
    notes: errors.length ? errors.join("; ") : "all executed actions verified",
    evidence: { pausedForApproval, finalReplySafe: !scanForMoney(finalReply).hasMoney },
  };
  const finalCycle = await rt.repos.cycles.update(cycle.id, {
    status: (pausedForApproval ? "waiting" : errors.length ? "failed" : "completed") as AgentCycleStatus,
    actionsAttempted: cycle.actionsAttempted,
    actionsCompleted: cycle.actionsCompleted,
    approvalRequestsCreated: cycle.approvalRequestsCreated,
    errors,
    verificationResult: verification,
    nextScheduledEventId,
    finishedAt: nowIso(),
    goalSnapshot: { ...goal },
  });

  // Release lock.
  if (rt.repos.goals instanceof MemoryGoalRepository) {
    (rt.repos.goals as MemoryGoalRepository).unlock(goal.id, runId);
  }

  return { cycle: finalCycle, reply: finalReply };
}

async function createGoalForEvent(rt: AgentRuntime, event: AgentEvent, now: string): Promise<AgentGoal> {
  const message = (event.payload.message as string) ?? "";
  const goalType: AgentGoalType = goalTypeForMessage(message);
  const objectiveByType: Record<AgentGoalType, string> = {
    qualify_booking_inquiry: "Qualify this guest inquiry sufficiently for staff to provide a current rate and availability response.",
    obtain_current_rate: "Obtain the owner-supplied current rate for the guest's stay.",
    confirm_current_availability: "Obtain a live availability confirmation from the owner or booking system.",
    resolve_guest_service_request: "Resolve the guest service request and acknowledge the guest.",
    handle_complaint: "Record and escalate the complaint for human resolution.",
    follow_up_lead: "Follow up with the qualified lead at the scheduled time.",
    complete_human_handoff: "Hand the conversation off to a human agent.",
  };
  const goal: AgentGoal = {
    id: uid("goal"),
    resortId: event.resortId,
    conversationId: event.conversationId,
    goalType,
    objective: objectiveByType[goalType],
    status: "active",
    successCriteria: ["guest details collected", "owner rate requested", "owner availability requested"],
    blockers: [],
    missingInformation: [],
    cycleCount: 0,
    createdAt: now,
    updatedAt: now,
    staleAt: new Date(Date.parse(now) + rt.cfg.goalStaleMs).toISOString(),
  };
  return rt.repos.goals.create(goal);
}

function makeCtx(
  rt: AgentRuntime,
  goal: AgentGoal,
  cycle: AgentCycle,
  leadId: string | undefined,
  reply: string,
  now: string,
) {
  return {
    resortId: goal.resortId,
    goalId: goal.id,
    cycleId: cycle.id,
    conversationId: goal.conversationId,
    leadId,
    reply,
    knowledge: undefined,
    runtime: rt.repos,
    persistent: rt.persistent,
    now,
  };
}

async function executeWithRetry(
  rt: AgentRuntime,
  tool: ReturnType<typeof getTool>,
  input: unknown,
  ctx: ReturnType<typeof makeCtx>,
): Promise<{ ok: boolean; output?: unknown; error?: string; retryable: boolean }> {
  if (!tool) return { ok: false, error: "no tool", retryable: false };
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    const res = await tool.execute(input, ctx);
    if (res.ok) return res;
    if (!res.retryable) return res;
    const decision = rt.safety.shouldRetry(attempt);
    if (!decision.ok) return { ok: false, error: res.error ?? "failed", retryable: false };
    // In a real deployment this would sleep; tests simulate by re-driving.
    return { ok: false, error: res.error ?? "temporary failure (retry scheduled)", retryable: true };
  }
}
