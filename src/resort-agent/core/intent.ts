/**
 * Intent classification — deterministic, pre-model. Ported from Onyx
 * instructions/resort-agent.md "Routing" + guest-response/booking-inquiry/
 * complaints routing rules. Used so we can gate monetary/availability/sensitive
 * flows BEFORE any model call and never feed stored monetary knowledge.
 */
import type { AgentIntent } from "../types.ts";

const COMPLAINT_RE =
  /\b(complaint|complain|unhappy|terrible|awful|ruined|refund|broken|disgusting|angry|problem with|issue with|not working)\b/i;

const HANDOFF_RE =
  /\b(speak to|talk to|human|real person|manager|staff|someone|agent now)\b/i;

const BOOKING_INQUIRY_RE =
  /\b(book|booking|reserve|reservation|stay|reserved|inquiry|enquiry|want to stay|room for)\b/i;

const AVAILABILITY_RE =
  /\b(availab\w*|open room|free room|rooms left|can i book|is .* available|do you have .* available|any rooms?|still have)\b/i;

const RATE_RE =
  /\b(how much|price|prices|rate|rates|cost|costs|fee|fees|discount|discounts|cheapest|cheaper|quote|quotation|per night|per person|refund|deposit|package|packages|php|pesos|total|pay|paying)\b/i;

const TRANSFER_RE =
  /\b(transfer|airport|van|shuttle|pick\s?up|ride)\b/i;

const SERVICE_RE =
  /\b(service|request|need|can you|could you|arrange|provide|extra|amenity)\b/i;

const ROOM_INFO_RE = /\b(room|suite|cottage|villa|accommodation|sleeps|size|amenit\w*)\b/i;

export interface IntentResult {
  intent: AgentIntent;
  /** Monetary/availability -> must not be answered with stored data. */
  isSensitive: boolean;
}

export function classifyIntent(message: string): IntentResult {
  const text = message || "";

  if (COMPLAINT_RE.test(text)) {
    return { intent: "complaint", isSensitive: true };
  }
  if (HANDOFF_RE.test(text)) {
    return { intent: "human_handoff", isSensitive: false };
  }
  if (RATE_RE.test(text)) {
    return { intent: "rate_request", isSensitive: true };
  }
  if (AVAILABILITY_RE.test(text)) {
    return { intent: "availability", isSensitive: true };
  }
  if (BOOKING_INQUIRY_RE.test(text)) {
    return { intent: "booking_inquiry", isSensitive: false };
  }
  if (TRANSFER_RE.test(text)) {
    return { intent: "guest_service", isSensitive: false };
  }
  if (SERVICE_RE.test(text) || ROOM_INFO_RE.test(text)) {
    return { intent: "guest_service", isSensitive: false };
  }
  return { intent: "general", isSensitive: false };
}
