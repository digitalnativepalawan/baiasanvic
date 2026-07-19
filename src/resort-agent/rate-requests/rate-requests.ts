/**
 * Rate requests — the Version 1 safe monetary workflow.
 *
 * Per governing spec: the AI NEVER creates a monetary quotation. Instead it
 * collects stay details and creates a structured RATE REQUEST (owner task).
 * The owner later checks today's price and manually enters it. The Onyx
 * calculate_quote.py logic is intentionally NOT ported as an AI price
 * calculator — it may only inform an owner-only workflow where the owner
 * manually supplies current monetary values.
 */
import type { ExtractedDetails, ResortKnowledgeBag } from "../types.ts";

export interface RateRequestDraft {
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  roomPreference?: string;
  transportNeeded?: boolean;
  specialRequests?: string;
  contactDetails?: string;
  preferredPlatform?: string;
}

/**
 * Build a rate-request draft from extracted details. No monetary field is
 * populated by the AI. Returns the structured object plus a guest-safe reply.
 */
export function buildRateRequest(
  details: ExtractedDetails,
  guest?: { name?: string; email?: string; phone?: string },
): { draft: RateRequestDraft; reply: string } {
  const draft: RateRequestDraft = {
    guestName: guest?.name,
    checkIn: details.checkIn,
    checkOut: details.checkOut,
    adults: details.adults,
    children: details.children,
    roomPreference: details.roomPreference,
    transportNeeded: details.transportNeeded,
    specialRequests: details.specialOccasion,
    contactDetails: guest?.email || guest?.phone,
  };

  const reply =
    "Rates change depending on the season, dates, room type, and current " +
    "availability. For the latest prices, please check BAIA's current listings " +
    "on Booking.com, Agoda, or Airbnb, or contact our team directly for today's " +
    "rate. If you share your dates and guest count, our team can prepare a " +
    "current quote for you.";

  return { draft, reply };
}

/** True when a rate request has enough to be useful to the owner. */
export function isRateRequestActionable(d: RateRequestDraft): boolean {
  return Boolean(d.checkIn && d.checkOut && (d.adults || d.children));
}

/** Helper to surface missing details the agent should ask for. */
export function missingRateFields(d: RateRequestDraft): string[] {
  const missing: string[] = [];
  if (!d.checkIn) missing.push("check-in date");
  if (!d.checkOut) missing.push("check-out date");
  if (!d.adults && !d.children) missing.push("number of guests");
  if (!d.roomPreference) missing.push("room preference");
  return missing;
}

// Re-export for callers that pass knowledge without using it (kept for parity).
export type _UnusedKnowledge = ResortKnowledgeBag;
