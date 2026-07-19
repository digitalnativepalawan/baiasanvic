/**
 * Resort Agent tool implementations (13). Each is an explicit, verifiable unit.
 * Ported from Onyx action model + BAIA guardrails:
 *   - create_guest_lead.py    -> create_or_update_lead
 *   - create_booking_request   -> create_rate_request / create_availability_check_request
 *   - request_approval.py      -> create_approval_request
 *   - schedule_followup.py     -> schedule_follow_up / cancel_follow_up
 *   - complaints.md escalation  -> escalate_to_staff / record_complaint
 *   - guest-response.md        -> answer_verified_question / collect_missing_guest_details
 *   - goal lifecycle           -> mark_goal_completed / mark_goal_lost
 *
 * No tool quotes a price or confirms availability. The rate/availability tools
 * only create OWNER tasks; external messaging is never performed here.
 */
import type { ResortAgentTool, ToolExecutionContext, ToolExecutionResult, ToolVerificationResult } from "./registry.ts";
import type { AgentRuntimeRepositories } from "../repositories.ts";
import { sanitizeReply } from "../../../baia/concierge.guardrails.ts";

function ok(output?: unknown, retryable = false): ToolExecutionResult {
  return { ok: true, output, retryable };
}
function fail(error: string, retryable = false): ToolExecutionResult {
  return { ok: false, error, retryable };
}

// 1. answer_verified_question — automatic, guest-facing, must be monetary-safe.
export const answerVerifiedQuestion: ResortAgentTool = {
  name: "answer_verified_question",
  description: "Reply to a guest with a verified, non-monetary, safe answer.",
  actionLevel: "automatic",
  validate(input: any) {
    if (typeof input?.content !== "string" || input.content.length === 0) return { ok: false, error: "missing content" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const g = sanitizeReply(String(input.content), "general");
    return ok({ reply: g.reply });
  },
  async verify(result: ToolExecutionResult): Promise<ToolVerificationResult> {
    return { verified: !!result.output?.reply && !/₱|\$|php|peso/i.test(String(result.output?.reply)), notes: "reply present and monetary-free", evidence: { reply: result.output?.reply } };
  },
};

// 2. collect_missing_guest_details — automatic, stores extracted fields on lead.
export const collectMissingGuestDetails: ResortAgentTool = {
  name: "collect_missing_guest_details",
  description: "Ask the guest for missing booking details (dates, occupancy, contact).",
  actionLevel: "automatic",
  validate(input: any) {
    if (!Array.isArray(input?.fields) || input.fields.length === 0) return { ok: false, error: "no fields" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const question = `To help with your stay, may I have: ${input.fields.join(", ")}?`;
    return ok({ reply: question });
  },
  async verify(result: ToolExecutionResult): Promise<ToolVerificationResult> {
    return { verified: !!result.output?.reply, notes: "clarification question built", evidence: {} };
  },
};

// 3. create_or_update_lead — automatic, internal lead record.
export const createOrUpdateLead: ResortAgentTool = {
  name: "create_or_update_lead",
  description: "Create or update a booking lead from collected details (no price/availability).",
  actionLevel: "automatic",
  validate(input: any) {
    if (!input || typeof input !== "object") return { ok: false, error: "bad input" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const repo = ctx.runtime as unknown as { leads?: any };
    const leads = (ctx.runtime as any)["leads"];
    if (!leads) return fail("lead repository unavailable", false);
    const lead = await leads.createOrUpdateByConversation(ctx.resortId, ctx.conversationId ?? "none", {
      channel: "website",
      guestName: input.guestName,
      email: input.email,
      phone: input.phone,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestCount: input.adults,
      childrenCount: input.children,
      roomPreference: input.roomPreference,
      transportNeeded: input.transportNeeded,
      status: input.status ?? "qualifying",
    });
    ctx.leadId = ctx.leadId ?? lead.id;
    return ok({ leadId: lead.id });
  },
  async verify(result: ToolExecutionResult, ctx: ToolExecutionContext): Promise<ToolVerificationResult> {
    const leads = (ctx.runtime as any)["leads"];
    const stored = result.output?.leadId ? await leads.get?.(result.output.leadId) : null;
    return { verified: !!stored, notes: stored ? "lead persisted and re-readable" : "lead not found", evidence: { leadId: result.output?.leadId } };
  },
};

// 4. create_rate_request — approval_required (owner task, no price).
export const createRateRequest: ResortAgentTool = {
  name: "create_rate_request",
  description: "Create an owner-only rate request; the agent never supplies a price.",
  actionLevel: "approval_required",
  validate(input: any) {
    if (!input?.leadId && !input?.guestName) return { ok: false, error: "needs lead or guest" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const rr = await ctx.runtime.rateRequests.create({
      resortId: ctx.resortId,
      leadId: input.leadId ?? ctx.leadId,
      guestName: input.guestName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      roomPreference: input.roomPreference,
      transportNeeded: input.transportNeeded,
      contactDetails: input.contactDetails,
      status: "pending",
    });
    return ok({ rateRequestId: rr.id });
  },
  async verify(result: ToolExecutionResult, ctx: ToolExecutionContext): Promise<ToolVerificationResult> {
    const stored = result.output?.rateRequestId ? await ctx.runtime.rateRequests.get?.(result.output.rateRequestId) : null;
    return { verified: !!stored && stored.status === "pending", notes: "rate request pending owner entry", evidence: { rateRequestId: result.output?.rateRequestId } };
  },
};

// 5. create_availability_check_request — approval_required (owner/booking-system task).
export const createAvailabilityCheckRequest: ResortAgentTool = {
  name: "create_availability_check_request",
  description: "Create an owner availability check; agent never confirms live availability.",
  actionLevel: "approval_required",
  validate(input: any) {
    if (!input?.leadId && !input?.guestName) return { ok: false, error: "needs lead or guest" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    // Reuse rate request record as the availability-check owner task container.
    const rr = await ctx.runtime.rateRequests.create({
      resortId: ctx.resortId,
      leadId: input.leadId ?? ctx.leadId,
      guestName: input.guestName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      roomPreference: input.roomPreference,
      transportNeeded: input.transportNeeded,
      contactDetails: input.contactDetails,
      status: "pending",
    });
    return ok({ availabilityRequestId: rr.id });
  },
  async verify(result: ToolExecutionResult): Promise<ToolVerificationResult> {
    return { verified: !!result.output?.availabilityRequestId, notes: "availability check queued for owner", evidence: {} };
  },
};

// 6. create_approval_request — approval_required mechanics (creates the request).
export const createApprovalRequest: ResortAgentTool = {
  name: "create_approval_request",
  description: "Create an approval request tied to the exact planned action/draft.",
  actionLevel: "approval_required",
  validate(input: any) {
    if (!input?.actionType) return { ok: false, error: "actionType required" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const ap = await ctx.runtime.approvals.create({
      resortId: ctx.resortId,
      leadId: input.leadId ?? ctx.leadId,
      conversationId: ctx.conversationId,
      actionType: input.actionType,
      draftContent: input.draftContent ?? "",
      riskLevel: input.riskLevel ?? "high",
      status: "pending",
    });
    return ok({ approvalId: ap.id });
  },
  async verify(result: ToolExecutionResult, ctx: ToolExecutionContext): Promise<ToolVerificationResult> {
    const stored = result.output?.approvalId ? await ctx.runtime.approvals.get?.(result.output.approvalId) : null;
    return { verified: !!stored && stored.status === "pending", notes: "approval pending, scope-bound", evidence: { approvalId: result.output?.approvalId, scope: result.output?.draftContent ? "draft-bound" : "action-bound" } };
  },
};

// 7/8. schedule_follow_up / cancel_follow_up — automatic, internal reminders.
export const scheduleFollowUp: ResortAgentTool = {
  name: "schedule_follow_up",
  description: "Schedule an internal follow-up reminder (never an auto outbound message).",
  actionLevel: "automatic",
  validate(input: any) {
    if (!input?.dueAt) return { ok: false, error: "dueAt required" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    await ctx.runtime.scheduler.schedule({
      id: `sched_${Math.random().toString(36).slice(2, 10)}`,
      resortId: ctx.resortId,
      goalId: ctx.goalId,
      leadId: ctx.leadId,
      eventType: "follow_up_due",
      payload: { reason: input.reason ?? "follow-up" },
      dueAt: input.dueAt,
      createdAt: ctx.now,
    });
    return ok({ scheduled: true });
  },
  async verify(_r, ctx: ToolExecutionContext): Promise<ToolVerificationResult> {
    const evs = await ctx.runtime.scheduler.getByGoal(ctx.goalId);
    const found = evs.some((e) => e.eventType === "follow_up_due" && !e.cancelled);
    return { verified: found, notes: found ? "follow-up event stored" : "follow-up missing", evidence: {} };
  },
};

export const cancelFollowUp: ResortAgentTool = {
  name: "cancel_follow_up",
  description: "Cancel pending follow-ups for the goal.",
  actionLevel: "automatic",
  validate() {
    return { ok: true };
  },
  async execute(_input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const evs = await ctx.runtime.scheduler.getByGoal(ctx.goalId);
    for (const e of evs) if (!e.cancelled) await ctx.runtime.scheduler.cancel(e.id);
    return ok({ cancelled: true });
  },
  async verify(_r, ctx: ToolExecutionContext): Promise<ToolVerificationResult> {
    const evs = await ctx.runtime.scheduler.getByGoal(ctx.goalId);
    const anyOpen = evs.some((e) => !e.cancelled);
    return { verified: !anyOpen, notes: anyOpen ? "some still open" : "all follow-ups cancelled", evidence: {} };
  },
};

// 9. escalate_to_staff — approval_required (human handoff / complaint / refund).
export const escalateToStaff: ResortAgentTool = {
  name: "escalate_to_staff",
  description: "Escalate to staff; no refund/compensation promised by the agent.",
  actionLevel: "approval_required",
  validate(input: any) {
    if (!input?.reason) return { ok: false, error: "reason required" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const ap = await ctx.runtime.approvals.create({
      resortId: ctx.resortId,
      leadId: ctx.leadId,
      conversationId: ctx.conversationId,
      actionType: "escalate_to_staff",
      draftContent: input.reason,
      riskLevel: "high",
      status: "pending",
    });
    return ok({ escalationId: ap.id, reply: "Thank you — I've flagged this with our team who will follow up directly." });
  },
  async verify(result: ToolExecutionResult): Promise<ToolVerificationResult> {
    return { verified: !!result.output?.escalationId, notes: "escalation queued", evidence: {} };
  },
};

// 10. record_guest_service_request — automatic, internal record + reply.
export const recordGuestServiceRequest: ResortAgentTool = {
  name: "record_guest_service_request",
  description: "Record a guest-service request internally and acknowledge the guest.",
  actionLevel: "automatic",
  validate(input: any) {
    if (!input?.summary) return { ok: false, error: "summary required" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    // Persist as an activity record (no guest-facing promise of price/service SLA).
    await ctx.runtime.activity.log({
      resortId: ctx.resortId,
      actor: "agent",
      action: "guest_service_request",
      entityType: "goal",
      entityId: ctx.goalId,
      summary: input.summary,
    });
    return ok({ reply: input.acknowledgement ?? "Noted — our team will arrange this and confirm details with you." });
  },
  async verify(result: ToolExecutionResult): Promise<ToolVerificationResult> {
    return { verified: !!result.output?.reply, notes: "service request acknowledged", evidence: {} };
  },
};

// 11. record_complaint — automatic record; unsafe promises prohibited by design.
export const recordComplaint: ResortAgentTool = {
  name: "record_complaint",
  description: "Record a complaint internally; agent never promises refunds/compensation.",
  actionLevel: "automatic",
  validate(input: any) {
    if (!input?.summary) return { ok: false, error: "summary required" };
    return { ok: true };
  },
  async execute(input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    await ctx.runtime.activity.log({
      resortId: ctx.resortId,
      actor: "agent",
      action: "complaint",
      entityType: "goal",
      entityId: ctx.goalId,
      summary: input.summary,
    });
    // The reply is fixed; it never offers a remedy.
    return ok({ reply: "I'm sorry to hear that. I've shared this with our team so they can address it personally." });
  },
  async verify(result: ToolExecutionResult): Promise<ToolVerificationResult> {
    const safe = !/refund|compensat|discount of|here is .*php|₱\d/i.test(String(result.output?.reply));
    return { verified: safe && !!result.output?.reply, notes: safe ? "safe acknowledgment" : "unsafe content blocked", evidence: {} };
  },
};

// 12/13. mark_goal_completed / mark_goal_lost — automatic lifecycle (goal repo).
export const markGoalCompleted: ResortAgentTool = {
  name: "mark_goal_completed",
  description: "Mark the active goal completed (after verified booking confirmation).",
  actionLevel: "automatic",
  validate() {
    return { ok: true };
  },
  async execute(_input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const g = await ctx.runtime.goals.update(ctx.goalId, { status: "completed", completedAt: ctx.now });
    return ok({ status: g.status });
  },
  async verify(result: ToolExecutionResult, ctx: ToolExecutionContext): Promise<ToolVerificationResult> {
    const g = await ctx.runtime.goals.get(ctx.goalId);
    return { verified: g?.status === "completed", notes: "goal completed", evidence: { completedAt: g?.completedAt } };
  },
};

export const markGoalLost: ResortAgentTool = {
  name: "mark_goal_lost",
  description: "Mark the goal lost/closed when recovery is not possible.",
  actionLevel: "automatic",
  validate() {
    return { ok: true };
  },
  async execute(_input: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const g = await ctx.runtime.goals.update(ctx.goalId, { status: "lost", completedAt: ctx.now });
    return ok({ status: g.status });
  },
  async verify(result: ToolExecutionResult, ctx: ToolExecutionContext): Promise<ToolVerificationResult> {
    const g = await ctx.runtime.goals.get(ctx.goalId);
    return { verified: g?.status === "lost", notes: "goal lost", evidence: {} };
  },
};

export const TOOL_REGISTRY: Record<string, ResortAgentTool> = {
  answer_verified_question: answerVerifiedQuestion,
  collect_missing_guest_details: collectMissingGuestDetails,
  create_or_update_lead: createOrUpdateLead,
  create_rate_request: createRateRequest,
  create_availability_check_request: createAvailabilityCheckRequest,
  create_approval_request: createApprovalRequest,
  schedule_follow_up: scheduleFollowUp,
  cancel_follow_up: cancelFollowUp,
  escalate_to_staff: escalateToStaff,
  record_guest_service_request: recordGuestServiceRequest,
  record_complaint: recordComplaint,
  mark_goal_completed: markGoalCompleted,
  mark_goal_lost: markGoalLost,
};

export function getTool(name: string): ResortAgentTool | undefined {
  return TOOL_REGISTRY[name];
}
