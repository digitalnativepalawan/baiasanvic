/**
 * Constrained planner — produces an explicit plan before execution. The LLM may
 * help phrase replies, but DETERMINISTIC POLICY controls: allowed actions,
 * approval requirements, no-price rules, availability rules, retry limits, and
 * completion conditions. The model is never the final authority on whether a
 * sensitive action is allowed.
 *
 * The planner is goal-aware: it loads the current goal + extracted details and
 * decides the next step toward the goal's success criteria. It does NOT invent
 * prices or confirm availability.
 */
import { classifyIntent } from "../core/intent.ts";
import { extractDetails, validateDetails } from "../qualification/qualification.ts";
import { scanForMoney } from "../../baia/concierge.guardrails.ts";
import type { AgentGoal, AgentEventType, AgentPlan, PlannedAction } from "../types.ts";

export interface PlanInput {
  resortId: string;
  goal: AgentGoal;
  message?: string; // present for guest_message_received
  lastReply?: string;
  now: string;
}

function replyForRateRequest(): string {
  return (
    "Rates change depending on the season, dates, room type, and current availability. " +
    "For the latest prices, please check BAIA's current listings on Booking.com, Agoda, or Airbnb, " +
    "or contact our team directly for today's rate."
  );
}

/**
 * Build the plan. Returns the plan + the guest-facing reply seed (set when the
 * planner decides a guest message is warranted this cycle).
 */
export function buildPlan(input: PlanInput): { plan: AgentPlan; reply: string } {
  const { goal, message, now } = input;
  const actions: PlannedAction[] = [];
  let reply = input.lastReply ?? "";
  const blockers: string[] = [...goal.blockers];
  const reasoningParts: string[] = [];

  // Resolve collected details: prefer message when present, else the persisted
  // goal state (so a resumed goal does not re-ask for supplied info).
  const details: Record<string, unknown> =
    message
      ? extractDetails(message, {})
      : { ...(goal.state ?? {}) };

  // Default safety: any proposed reply must be monetary-free.
  const safe = (r: string) => (scanForMoney(r).hasMoney ? replyForRateRequest() : r);

  switch (goal.goalType) {
    case "qualify_booking_inquiry":
    case "obtain_current_rate":
    case "confirm_current_availability": {
      const missing: string[] = [];
      if (!details.checkIn) missing.push("check-in date");
      if (!details.adults) missing.push("number of guests");
      if (!goal.leadId) {
        actions.push({
          toolName: "create_or_update_lead",
          actionLevel: "automatic",
          input: { ...details },
          reasoning: "Capture the inquiry as a lead so staff can act.",
          requiresApproval: false,
        });
      } else if ((details.checkIn && details.adults) || message) {
        actions.push({
          toolName: "create_or_update_lead",
          actionLevel: "automatic",
          input: { ...details },
          reasoning: "Update lead with newly supplied details.",
          requiresApproval: false,
        });
      }
      if (missing.length > 0) {
        actions.push({
          toolName: "collect_missing_guest_details",
          actionLevel: "automatic",
          input: { fields: missing },
          reasoning: "Guest has not supplied all booking details; ask for the missing ones.",
          requiresApproval: false,
        });
        // For rate/availability goals, always redirect to live channels too.
        const isRateOrAvail = goal.goalType === "obtain_current_rate" || goal.goalType === "confirm_current_availability";
        const platformNote = isRateOrAvail
          ? " For current availability and rates, please check BAIA's listings on Booking.com, Agoda, or Airbnb, or contact our team directly."
          : "";
        reply = safe(`To prepare today's rate and availability for you, may I have ${missing.join(" and ")}?${platformNote}`);
        reasoningParts.push(`The guest supplied some details but is missing ${missing.join(", ")}. Collect those, then request an owner availability and rate check.`);
        return { plan: finalize(goal, actions, reasoningParts, "waiting_for_guest", "Guest asked for missing details; goal waits for reply."), reply };
      }
      // All core details present -> request owner rate + availability (approval).
      actions.push({
        toolName: "create_rate_request",
        actionLevel: "approval_required",
        input: { leadId: goal.leadId, ...details },
        reasoning: "All stay details present; ask owner to supply current rate (no AI price).",
        requiresApproval: true,
      });
      actions.push({
        toolName: "create_availability_check_request",
        actionLevel: "approval_required",
        input: { leadId: goal.leadId, ...details },
        reasoning: "Ask owner/booking-system for live availability (never confirm from static counts).",
        requiresApproval: true,
      });
      reply = safe(replyForRateRequest());
      reasoningParts.push("Stay details complete. Create owner rate and availability check requests; pause for staff.");
      return { plan: finalize(goal, actions, reasoningParts, "waiting_for_approval", "Owner rate/availability requests created; goal waits for staff."), reply };
    }

    case "resolve_guest_service_request": {
      actions.push({
        toolName: "record_guest_service_request",
        actionLevel: "automatic",
        input: { summary: message ?? "guest service request", acknowledgement: reply || undefined },
        reasoning: "Record the request; acknowledge without promising price or SLA.",
        requiresApproval: false,
      });
      reasoningParts.push("Guest service request recorded and acknowledged.");
      return { plan: finalize(goal, actions, reasoningParts, "completed", "Service request handled; goal completed."), reply: safe(reply || "Noted — our team will arrange this and confirm details with you.") };
    }

    case "handle_complaint": {
      actions.push({
        toolName: "record_complaint",
        actionLevel: "automatic",
        input: { summary: message ?? "complaint" },
        reasoning: "Log the complaint; never promise a refund or compensation.",
        requiresApproval: false,
      });
      actions.push({
        toolName: "escalate_to_staff",
        actionLevel: "approval_required",
        input: { reason: message ?? "complaint" },
        reasoning: "Escalate to staff for human resolution.",
        requiresApproval: true,
      });
      reply = safe("I'm sorry to hear that. I've shared this with our team so they can address it personally.");
      reasoningParts.push("Complaint recorded and escalated to staff; no remedy promised by the agent.");
      return { plan: finalize(goal, actions, reasoningParts, "waiting_for_approval", "Complaint escalated; goal waits for human resolution."), reply };
    }

    case "follow_up_lead": {
      actions.push({
        toolName: "schedule_follow_up",
        actionLevel: "automatic",
        input: { dueAt: new Date(Date.parse(now) + 1000 * 60 * 60 * 24 * 2).toISOString(), reason: "lead follow-up" },
        reasoning: "Schedule an internal follow-up reminder.",
        requiresApproval: false,
      });
      reasoningParts.push("Follow-up reminder scheduled; goal continues on schedule.");
      return { plan: finalize(goal, actions, reasoningParts, "waiting_for_time", "Follow-up scheduled."), reply };
    }

    case "complete_human_handoff": {
      actions.push({
        toolName: "escalate_to_staff",
        actionLevel: "approval_required",
        input: { reason: "guest requested a human" },
        reasoning: "Hand off to a human agent.",
        requiresApproval: true,
      });
      reasoningParts.push("Guest requested a human; escalate.");
      return { plan: finalize(goal, actions, reasoningParts, "waiting_for_approval", "Handoff escalated."), reply: safe("Connecting you with our team now.") };
    }
  }

  // Fallback safety plan.
  actions.push({
    toolName: "answer_verified_question",
    actionLevel: "automatic",
    input: { content: reply || "Happy to help! Share your dates and we'll point you to the right place." },
    reasoning: "Fallback safe answer.",
    requiresApproval: false,
  });
  return { plan: finalize(goal, actions, ["Fallback safe answer."], "active", "Safe fallback."), reply: safe(reply) };
}

function finalize(
  goal: AgentGoal,
  actions: PlannedAction[],
  reasoningParts: string[],
  nextState: AgentGoal["status"],
  expected: string,
): AgentPlan {
  return {
    goalId: goal.id,
    reasoningSummary: reasoningParts.join(" "),
    blockers: goal.blockers,
    actions,
    expectedOutcome: expected,
    nextState,
  };
}

/** Decide the initial goal type from a guest message (deterministic). */
export function goalTypeForMessage(message: string): AgentGoal["goalType"] {
  const { intent } = classifyIntent(message);
  switch (intent) {
    case "rate_request":
    case "booking_inquiry":
      return "qualify_booking_inquiry";
    case "complaint":
      return "handle_complaint";
    case "guest_service":
      return "resolve_guest_service_request";
    case "human_handoff":
      return "complete_human_handoff";
    default:
      return "qualify_booking_inquiry";
  }
}
