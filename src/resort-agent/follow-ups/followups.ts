/**
 * Follow-ups — internal reminder records only. Ported from Onyx
 * schedule_followup.py semantics: a follow-up is an internal owner task, never
 * an automatic outbound message. In Version 1 no follow-up is sent automatically.
 */
import type { AgentAction } from "../types.ts";

export interface FollowUpDraft {
  dueAt?: string;
  note?: string;
}

export function scheduleFollowUp(draft: FollowUpDraft): AgentAction {
  return { type: "schedule_followup", status: "draft" };
}
