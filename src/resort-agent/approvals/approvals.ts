/**
 * Approvals — the owner gate. Ported from Onyx instructions/approvals.md and
 * request_approval.py: a proposed action is HELD for owner sign-off; nothing is
 * sent to the guest until approved. This module is pure decision logic; the
 * actual persistence is delegated to the repository adapter (memory or Supabase).
 */
import type { AgentAction } from "../types.ts";

export type ApprovalActionType =
  | "send_quotation"
  | "offer_discount"
  | "confirm_availability"
  | "confirm_booking"
  | "change_dates"
  | "promise_refund"
  | "send_followup"
  | "escalate_with_compensation"
  | "proposed_transfer";

export interface ApprovalRequest {
  resortId: string;
  sessionId: string;
  actionType: ApprovalActionType;
  draftContent: string;
  verifiedFacts?: Record<string, unknown>;
  missingInfo?: string[];
  riskLevel: "low" | "medium" | "high";
}

/**
 * Build a "held for approval" action. The caller must NOT send draftContent to
 * the guest. Returns the action plus the guest-facing hold message.
 */
export function holdForApproval(req: ApprovalRequest): {
  action: AgentAction;
  holdMessage: string;
} {
  return {
    action: {
      type: req.actionType,
      status: "pending_approval",
    },
    holdMessage:
      "I'll confirm that with the owner and get back to you shortly.",
  };
}
