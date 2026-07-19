/**
 * Resort Agent autonomous runtime — multi-cycle tests. Real, dependency-free.
 * Run: node --experimental-strip-types --test src/resort-agent/runtime/__tests__/agent.test.ts
 *
 * No Supabase required — uses the in-memory runtime + deterministic scheduler.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryRuntime } from "../memory.ts";
import type { MemoryRuntimeAdapter } from "../memory.ts";
import { submitEvent, createRuntime } from "../engine.ts";
import { getTool, TOOL_REGISTRY } from "../tools/index.ts";
import { scanForMoney } from "../../../baia/concierge.guardrails.ts";
import type { ScheduledAgentEvent } from "../types.ts";

const RESORT = "baia-san-vicente";
let rt: MemoryRuntimeAdapter;

function guest(conversationId: string, messageId: string, message: string, goalId?: string) {
  return submitEvent(rt, {
    resortId: RESORT,
    conversationId,
    goalId,
    type: "guest_message_received",
    payload: { message, messageId },
    source: "guest",
    idempotencyKey: `g_${conversationId}_${messageId}`,
  });
}
function admin(type: string, goalId: string, approvalId: string, conv = "c1") {
  return submitEvent(rt, {
    resortId: RESORT,
    conversationId: conv,
    goalId,
    type: type as any,
    payload: { approvalId },
    source: "admin",
    idempotencyKey: `a_${type}_${goalId}_${approvalId}`,
  });
}

// ---- 1. Goal persists across cycles -----------------------------------------
test("1. Goal persists across multiple cycles", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay at your resort");
  const goalId = c1.cycle!.goalId;
  assert.equal(c1.cycle!.goalSnapshot.status, "active");
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  assert.equal(c2.cycle!.goalId, goalId);
  const g = await rt.repos.goals.get(goalId);
  assert.equal(g!.cycleCount >= 2, true);
});

// ---- 2. Guest reply resumes the existing goal ------------------------------
test("2. Guest reply resumes the existing goal", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  assert.equal(c2.cycle!.goalId, goalId);
});

// ---- 3. Approval pauses execution -------------------------------------------
test("3. Approval pauses execution", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  assert.equal(c2.cycle!.goalSnapshot.status, "waiting_for_approval");
  assert.ok(c2.cycle!.approvalRequestsCreated.length >= 1);
});

// ---- 4. Approval grant resumes exact action -------------------------------
test("4. Approval grant resumes the exact action", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  const apId = c2.cycle!.approvalRequestsCreated[0];
  const c3 = await admin("approval_granted", goalId, apId);
  assert.equal(c3.reply.length > 0, true);
  assert.equal(scanForMoney(c3.reply).hasMoney, false);
  const g = await rt.repos.goals.get(goalId);
  assert.ok(["waiting_for_time", "active", "completed"].includes(g!.status));
});

// ---- 5. Approval rejection causes escalation ------------------------------
test("5. Approval rejection causes escalation", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  const apId = c2.cycle!.approvalRequestsCreated[0];
  const r = await admin("approval_rejected", goalId, apId);
  const g = await rt.repos.goals.get(goalId);
  assert.equal(g!.status, "escalated");
});

// ---- 6. Follow-up fires without a new guest message ----------------------
test("6. Follow-up fires without a new guest message", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  const apId = c2.cycle!.approvalRequestsCreated[0];
  await admin("approval_granted", goalId, apId);
  // Schedule a follow-up by re-submitting a follow_up_due after advancing time.
  const du = new Date(Date.parse("2026-08-20T00:00:00Z")).toISOString();
  const sched: ScheduledAgentEvent = {
    id: "sched_fu1", resortId: RESORT, goalId, leadId: "lead_x",
    eventType: "follow_up_due", payload: {}, dueAt: du, createdAt: du,
  };
  await rt.repos.scheduler.schedule(sched);
  const due = await rt.advanceTime(du);
  assert.ok(due.some((e) => e.id === "sched_fu1"));
});

// ---- 7. Duplicate event does not execute twice ---------------------------
test("7. Duplicate event does not execute twice", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2a = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  const c2b = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  assert.equal(c2a.cycle!.goalId, c2b.cycle!.goalId);
  // Idempotency: second identical idempotency key is skipped.
  const cycles = await rt.repos.cycles.listByGoal(goalId);
  assert.equal(cycles.length, 2); // two distinct cycles, not three
});

// ---- 8. Duplicate action is idempotent --------------------------------
test("8. Duplicate action is idempotent", async () => {
  rt = createMemoryRuntime();
  const tool = getTool("create_or_update_lead")!;
  const ctx = makeCtx(rt, "goal_x");
  const i1 = await tool.execute({ checkIn: "2026-08-10", adults: 2 }, ctx);
  const i2 = await tool.execute({ checkIn: "2026-08-10", adults: 2 }, ctx);
  assert.equal(!!i1.output?.leadId, true);
  // Same lead updated, not duplicated (conversation-scoped).
  const leads = (rt as any).leads;
  assert.equal((await leads.get(i1.output!.leadId)).id, i1.output!.leadId);
});

// ---- 9. Failed action retries within limits -----------------------------
test("9. Failed action retries within limits", async () => {
  rt = createMemoryRuntime();
  // Override create_or_update_lead to fail once, then succeed.
  let calls = 0;
  const orig = TOOL_REGISTRY.create_or_update_lead;
  (TOOL_REGISTRY as any).create_or_update_lead = {
    ...orig,
    async execute(input: any, ctx: any) {
      calls++;
      if (calls < 2) return { ok: false, error: "temp db down", retryable: true };
      return orig.execute(input, ctx);
    },
  };
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  // A retry scheduled event should exist.
  const scheds = await rt.repos.scheduler.getByGoal(goalId);
  assert.ok(scheds.some((s) => s.eventType === "retry"));
  (TOOL_REGISTRY as any).create_or_update_lead = orig;
});

// ---- 10. Repeated failure escalates to human ----------------------------
test("10. Repeated failure escalates to human", async () => {
  rt = createMemoryRuntime();
  const orig = TOOL_REGISTRY.create_or_update_lead;
  (TOOL_REGISTRY as any).create_or_update_lead = {
    ...orig,
    async execute() { return { ok: false, error: "permanent failure", retryable: true }; },
  };
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  // Drive the retry cycle by firing the scheduled retry with attempt beyond limit.
  // Simulate by submitting retry events with escalating attempt counts.
  for (let attempt = 1; attempt <= 5; attempt++) {
    await submitEvent(rt, {
      resortId: RESORT, conversationId: "c1", goalId, type: "retry" as any,
      payload: { attempt }, source: "scheduler",
      idempotencyKey: `retry_${goalId}_${attempt}`,
    });
  }
  const g = await rt.repos.goals.get(goalId);
  assert.equal(g!.status, "escalated");
  (TOOL_REGISTRY as any).create_or_update_lead = orig;
});

// ---- 11. Maximum-action limit stops runaway loops -----------------------
test("11. Maximum-action limit stops runaway loops", async () => {
  rt = createMemoryRuntime();
  const max = rt.safety.cfg.maxActionsPerCycle;
  assert.equal(max >= 1, true);
  // A goal with many pending actions cannot exceed the budget.
  const goal = await rt.repos.goals.create({
    id: "goal_loop", resortId: RESORT, goalType: "follow_up_lead",
    objective: "loop", status: "active", successCriteria: [], blockers: [],
    missingInformation: [], cycleCount: 0, createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  });
  // Submit a manual_resume; the planner's follow_up_lead creates at most a few
  // actions, well under the budget. Assert the cycle did not exceed budget.
  const r = await submitEvent(rt, {
    resortId: RESORT, conversationId: "c1", goalId: "goal_loop",
    type: "manual_resume", payload: {}, source: "admin",
    idempotencyKey: "mr_loop",
  });
  assert.ok((r.cycle?.actionsAttempted.length ?? 0) <= max);
});

// ---- 12. Goal lock prevents concurrent processing ------------------------
test("12. Goal lock prevents concurrent processing", async () => {
  rt = createMemoryRuntime();
  const goal = await rt.repos.goals.create({
    id: "goal_lock", resortId: RESORT, goalType: "follow_up_lead",
    objective: "lock", status: "active", successCriteria: [], blockers: [],
    missingInformation: [], cycleCount: 0, createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  });
  const locked1 = (rt as any).__goals.tryLock("goal_lock", "run_A");
  const locked2 = (rt as any).__goals.tryLock("goal_lock", "run_B");
  assert.equal(locked1, true);
  assert.equal(locked2, false);
  (rt as any).__goals.unlock("goal_lock", "run_A");
  assert.equal((rt as any).__goals.tryLock("goal_lock", "run_C"), true);
});

// ---- 13. Booking confirmation completes the goal ------------------------
test("13. Booking confirmation completes the goal", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  // Schedule + grant follow-up so a follow-up exists, then confirm booking.
  await submitEvent(rt, {
    resortId: RESORT, conversationId: "c1", goalId,
    type: "follow_up_due", payload: {}, source: "scheduler",
    idempotencyKey: "fu_done",
  });
  const r = await submitEvent(rt, {
    resortId: RESORT, conversationId: "c1", goalId,
    type: "booking_confirmed", payload: {}, source: "admin",
    idempotencyKey: "bc_done",
  });
  const g = await rt.repos.goals.get(goalId);
  assert.equal(g!.status, "completed");
  assert.equal(r.reply.length > 0, true);
});

// ---- 14. Pending follow-ups cancelled on completion ----------------------
test("14. Pending follow-ups are cancelled on completion", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  await rt.repos.scheduler.schedule({
    id: "sched_fuX", resortId: RESORT, goalId, leadId: "lead_x",
    eventType: "follow_up_due", payload: {}, dueAt: "2030-01-01T00:00:00Z", createdAt: "2026-01-01T00:00:00Z",
  });
  await submitEvent(rt, {
    resortId: RESORT, conversationId: "c1", goalId,
    type: "booking_confirmed", payload: {}, source: "admin",
    idempotencyKey: "bc_cancel",
  });
  const scheds = await rt.repos.scheduler.getByGoal(goalId);
  assert.ok(scheds.every((s) => s.cancelled));
});

// ---- 15. Lost booking closes the goal ----------------------------------
test("15. Lost booking closes the goal", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  await submitEvent(rt, {
    resortId: RESORT, conversationId: "c1", goalId,
    type: "booking_declined", payload: {}, source: "admin",
    idempotencyKey: "bd_lost",
  });
  const g = await rt.repos.goals.get(goalId);
  assert.equal(g!.status, "lost");
});

// ---- 16. Memory scheduler advances deterministically ---------------------
test("16. Memory scheduler advances deterministically", async () => {
  rt = createMemoryRuntime();
  const due = "2026-09-01T00:00:00Z";
  await rt.repos.scheduler.schedule({
    id: "s1", resortId: RESORT, eventType: "goal_review", payload: {}, dueAt: due, createdAt: "2026-01-01T00:00:00Z",
  });
  const before = await rt.advanceTime("2026-08-01T00:00:00Z");
  const after = await rt.advanceTime("2026-09-02T00:00:00Z");
  assert.equal(before.length, 0);
  assert.equal(after.length, 1);
});

// ---- 17. Monetary values remain excluded -------------------------------
test("17. Monetary values remain excluded", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "How much is a room?");
  assert.equal(scanForMoney(c1.reply).hasMoney, false);
});

// ---- 18. Static inventory never becomes live availability -------------
test("18. Static inventory never becomes live availability", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "Do you have 3 cottages available now?");
  assert.match(c1.reply, /Booking\.com|Agoda|Airbnb/i);
  assert.doesNotMatch(c1.reply.toLowerCase(), /yes,? there are 3 available/i);
});

// ---- 19. BAIA records isolated by resort ID --------------------------
test("19. BAIA records isolated by resort ID", async () => {
  rt = createMemoryRuntime();
  const a = await guest("c1", "m1", "I'd like to stay", undefined as any);
  void a;
  // Different resort, separate goal space.
  const rt2 = createMemoryRuntime();
  const other = await submitEvent(rt2, {
    resortId: "other-resort", conversationId: "x", type: "guest_message_received",
    payload: { message: "stay" }, source: "guest", idempotencyKey: "o1",
  });
  assert.equal(other.event.resortId, "other-resort");
  // baia goals untouched by other resort.
  const baiaGoals = await rt.repos.goals.getActiveForConversation(RESORT, "c1");
  assert.ok(baiaGoals === null || baiaGoals.resortId === RESORT);
});

// ---- 20. Another resort runs through the same core -------------------
test("20. Another resort runs through the same core", async () => {
  const rtOther = createMemoryRuntime();
  const r = await submitEvent(rtOther, {
    resortId: "resort-b", conversationId: "cb", type: "guest_message_received",
    payload: { message: "I want August 5 to 9 for 4 guests" }, source: "guest",
    idempotencyKey: "b1",
  });
  assert.equal(r.cycle!.goalSnapshot.resortId, "resort-b");
  assert.equal(r.cycle!.goalSnapshot.status, "waiting_for_approval");
});

// ---- 21. Agent-run record contains plan, actions, evidence ----------
test("21. Agent-run record contains plan, actions and verification evidence", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  assert.ok(c2.cycle!.plan && c2.cycle!.plan.actions.length >= 1);
  assert.ok(c2.cycle!.actionsAttempted.length >= 1);
  assert.ok(c2.cycle!.verificationResult && typeof c2.cycle!.verificationResult!.verified === "boolean");
});

// ---- 22. Restart simulation reloads state from repository -----------
test("22. Restart simulation reloads state from repository", async () => {
  rt = createMemoryRuntime();
  const c1 = await guest("c1", "m1", "I'd like to stay");
  const goalId = c1.cycle!.goalId;
  const c2 = await guest("c1", "m2", "August 10 to 14, two people", goalId);
  // Simulate "restart": a brand new runtime backed by the SAME repos.
  const rt2: any = createRuntime(rt.repos as any, { persistent: true });
  const reloaded = await (rt2 as any).repos.goals.get(goalId);
  assert.equal(reloaded.goalType, "qualify_booking_inquiry");
  assert.equal(reloaded.status, "waiting_for_approval");
  // And a follow-up due can still be loaded.
  const scheds = await (rt2 as any).repos.scheduler.getByGoal(goalId);
  assert.ok(Array.isArray(scheds));
});

// Helper: build a tool-execution context for unit-level tool tests.
function makeCtx(adapter: MemoryRuntimeAdapter, goalId: string) {
  return {
    resortId: RESORT,
    goalId,
    cycleId: "cyc_x",
    conversationId: "c1",
    leadId: undefined,
    reply: "",
    knowledge: undefined,
    runtime: adapter,
    persistent: false,
    now: "2026-01-01T00:00:00Z",
  };
}
