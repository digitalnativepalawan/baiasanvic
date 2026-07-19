/**
 * Complaints — ported from Onyx instructions/complaints.md. Listen, acknowledge,
 * capture context, and hand off to staff. NEVER promise refunds or compensation
 * (those are approval-required / never-autonomous). If compensation is implied,
 * hold for approval.
 */
import type { AgentAction } from "../types.ts";
import { holdForApproval, type ApprovalActionType } from "../approvals/approvals.ts";

export interface ComplaintResult {
  reply: string;
  actions: AgentAction[];
  escalate: boolean;
}

export function handleComplaint(message: string): ComplaintResult {
  const mentionsCompensation = /\b(refund|compensat\w*|discount|free|upgrade|money back)\b/i.test(
    message,
  );

  if (mentionsCompensation) {
    const { action, holdMessage } = holdForApproval({
      resortId: "",
      sessionId: "",
      actionType: "escalate_with_compensation",
      draftContent: "Guest raised a complaint implying compensation/refund.",
      riskLevel: "high",
    });
    return {
      reply:
        "I'm so sorry to hear that — thank you for letting us know. " +
        holdMessage,
      actions: [action],
      escalate: true,
    };
  }

  return {
    reply:
      "I'm sorry to hear that, and I appreciate you telling us. I've flagged " +
      "this with our team so they can look into it right away. Is there anything " +
      "else you'd like me to share with them?",
    actions: [{ type: "escalate_to_staff", status: "draft" }],
    escalate: true,
  };
}
