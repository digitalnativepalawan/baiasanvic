/**
 * Core-path (OpenRouter / Ollama) guest-lead capture.
 *
 * Onyx's own tool-calling can create a lead when it's the active brain, but
 * the goal is a concierge that works end to end WITHOUT depending on Onyx.
 * This module gives the core path the same capability: when a guest message
 * contains enough qualified detail (contact info + dates + explicit consent),
 * extract it deterministically (no LLM call, so it never accidentally invents
 * or confirms anything) and hand it to the same guest-lead write boundary
 * Onyx uses (`ops/guest-lead.server.ts`), so idempotency and the no-price /
 * no-booking-confirmation rules are enforced identically either way.
 *
 * This is intentionally conservative: if the message doesn't clearly contain
 * an email AND a date AND an explicit consent signal, nothing is captured and
 * the turn falls through to the normal model-answered reply.
 */

export interface ExtractedBookingInquiry {
  name: string | null;
  email: string;
  phone: string | null;
  checkIn: string | null;
  checkOut: string | null;
  adults: number | null;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /\+?\d[\d\s-]{7,}\d/;
const NAME_RE = /\bname\s*[:\-]\s*([^.,;\n]{2,60})/i;
const CHECKIN_RE = /\b(?:arrival|check[\s-]?in)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i;
const CHECKOUT_RE = /\b(?:departure|check[\s-]?out)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i;
const GENERIC_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const ADULTS_RE = /\b(\d{1,2})\s*adults?\b/i;
const CONSENT_RE =
  /\bconsent\b|\bi\s+agree\b|\byou\s+(?:may|can)\s+contact\s+me\b|\bokay\s+to\s+contact\b|\bok\s+to\s+contact\b/i;

/**
 * Returns extracted details when the message clearly qualifies as a
 * bookable guest inquiry (email + at least one date + explicit consent), or
 * null when the signal isn't strong enough to safely act on.
 */
export function extractBookingInquiry(message: string): ExtractedBookingInquiry | null {
  const text = (message || "").trim();
  if (!text) return null;

  const emailMatch = text.match(EMAIL_RE);
  const hasConsent = CONSENT_RE.test(text);
  if (!emailMatch || !hasConsent) return null;

  let checkIn = text.match(CHECKIN_RE)?.[1] ?? null;
  let checkOut = text.match(CHECKOUT_RE)?.[1] ?? null;
  if (!checkIn && !checkOut) {
    const genericDates = text.match(GENERIC_DATE_RE);
    if (genericDates && genericDates.length >= 1) {
      checkIn = genericDates[0] ?? null;
      checkOut = genericDates[1] ?? null;
    }
  }
  if (!checkIn && !checkOut) return null;

  const nameMatch = text.match(NAME_RE);
  const phoneMatch = text.match(PHONE_RE);
  const adultsMatch = text.match(ADULTS_RE);

  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    email: emailMatch[0],
    phone: phoneMatch ? phoneMatch[0].trim() : null,
    checkIn,
    checkOut,
    adults: adultsMatch ? Number(adultsMatch[1]) : null,
  };
}

/** Guest-safe confirmation reply. Never confirms booking/availability. */
export function buildLeadConfirmationReply(alreadyOnFile: boolean): string {
  if (alreadyOnFile) {
    return (
      "Thanks again — we already have this inquiry on file, so there's no need to resend it. " +
      "Our team will follow up by email to confirm availability and next steps."
    );
  }
  return (
    "Thank you — I've passed your inquiry to our team with the dates and details you shared. " +
    "They'll follow up by email shortly to confirm availability and rates; nothing is booked or " +
    "charged yet. You're welcome to keep asking me about BAIA in the meantime."
  );
}
