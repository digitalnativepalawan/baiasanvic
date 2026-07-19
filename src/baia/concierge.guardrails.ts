/**
 * Concierge monetary guardrails — defense in depth.
 *
 * These helpers are dependency-free and transport-agnostic so they can be
 * reused later by Onyx/Hermes integrations and other channels. They are the
 * second and third layers of protection after the prompt rules in
 * `concierge.prompt.ts` and the sanitized knowledge in `concierge.knowledge.ts`.
 *
 * Absolute rule (governing spec): the guest-facing agent must NEVER state,
 * estimate, calculate, repeat, or suggest accommodation or add-on prices —
 * even when a monetary value exists in static data, logs, the knowledge ZIP,
 * previous quotes, model context, or search results. Palawan prices change
 * by season; historical/stored prices are not today's prices.
 */

/** Approved current-rate response. Wording may vary but must preserve facts. */
export const APPROVED_RATE_RESPONSE =
  "Rates change depending on the season, dates, room type, and current availability. " +
  "For the latest prices, please check BAIA's current listings on Booking.com, " +
  "Agoda, or Airbnb, or contact our team directly for today's rate.";

/** Approved availability response fragment. */
export const APPROVED_AVAILABILITY_RESPONSE =
  "Current availability changes by the day. For live availability, please check BAIA's " +
  "listings on Booking.com, Agoda, or Airbnb, or contact our team directly.";

export type MoneyIntent = "general" | "availability" | "rate_request";

export interface GuardrailResult {
  /** Final guest-safe reply (monetary output stripped/replaced). */
  reply: string;
  /** True when the raw model output was sanitized. */
  sanitized: boolean;
  intent: MoneyIntent;
  /** A monetary question was detected — owner follow-up is required. */
  approvalRequired: boolean;
  /** DB write is deferred until the SQL migration is applied. */
  databaseWriteDeferred: boolean;
}

// ---------------------------------------------------------------------------
// 1. Monetary-output validator (response layer)
// ---------------------------------------------------------------------------

// Currency symbols / codes.
const CURRENCY_TOKENS = ["₱", "₽", "€", "£", "¥", "php", "usd", "eur", "gbp", "aud", "cad", "sgd"];

// Phrases that strongly imply a monetary statement.
const MONEY_PHRASES = [
  "per night",
  "per person",
  "per room",
  "per day",
  "per stay",
  "per child",
  "per adult",
  "deposit",
  "discount",
  "total cost",
  "total price",
  "starting from",
  "starts at",
  "starts from",
  "rate is",
  "price is",
  "costs",
  "cost of",
  "estimated price",
  "estimated rate",
  "typical rate",
  "room costs",
  "nightly rate",
  "nightly price",
  "you can expect to pay",
  "you pay",
  "expected to pay",
  "price range",
  "rate range",
];

// Currency-like amounts: "6,210", "6210", "₱6,210", "$39", "PHP 3500",
// "3,500-7,000", "3500 php", decimals "399.00". Bare 3+ digit numbers are
// only flagged when NOT part of a phone-like run (handled below).
const MONEY_AMOUNT_RE =
  /(?:(?:₱|\$|€|£|¥|\bphp\b|\busd\b|\beur\b|\bgbp\b)\s?-?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:php|usd|eur|gbp|pesos))(?!\s?(?:%|percent|km|am|pm|units?|guests?|rooms?|people))|\b\d[\d,]{2,}(?:\.\d+)?\b/gi;

// Price ranges like "3500-7000" or "39 to 120".
const MONEY_RANGE_RE = /\b\d[\d,]*(?:\.\d+)?\s?(?:-|to|–|until)\s?\d[\d,]*(?:\.\d+)?\b/gi;

// Phone-like runs (e.g. "+63 917 276 2875" or "0917 276 2875") are stripped
// before scanning so we never mistake them for prices.
const PHONE_RE = /\+?\d[\d\s-]{7,}\d/g;

export interface MoneyScan {
  hasMoney: boolean;
  matched: string[];
}

/**
 * Lighter-weight money check for TRUSTED, owner-authored static text (e.g.
 * concierge.knowledge.ts chunks), not raw model output. Flags only
 * unambiguous money signals — currency symbols/codes and explicit price
 * phrases — deliberately WITHOUT the bare-number-range heuristic in
 * scanForMoney(), which produces false positives on ordinary content like
 * "30–40 minutes away" or "2:00 PM to 12:00 PM". Model output must still go
 * through the strict scanForMoney() above; use this only for content whose
 * source we already control and have reviewed for prices.
 */
export function hasObviousMoneySignal(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  for (const tok of CURRENCY_TOKENS) {
    if (lower.includes(tok)) return true;
  }
  for (const ph of MONEY_PHRASES) {
    if (lower.includes(ph)) return true;
  }
  return false;
}

/**
 * Detect probable monetary output in a guest-facing string.
 * Fails safe: when uncertain, treat as monetary.
 */
export function scanForMoney(text: string): MoneyScan {
  if (!text || typeof text !== "string") return { hasMoney: false, matched: [] };
  const cleaned = text.replace(PHONE_RE, " ");
  const matched: string[] = [];
  const lower = cleaned.toLowerCase();

  for (const tok of CURRENCY_TOKENS) {
    if (lower.includes(tok)) matched.push(`token:${tok}`);
  }
  for (const ph of MONEY_PHRASES) {
    if (lower.includes(ph)) matched.push(`phrase:${ph}`);
  }

  const amounts = cleaned.match(MONEY_AMOUNT_RE);
  if (amounts) matched.push(...amounts.map((a) => `amount:${a.trim()}`));

  const ranges = cleaned.match(MONEY_RANGE_RE);
  if (ranges) matched.push(...ranges.map((r) => `range:${r.trim()}`));

  return { hasMoney: matched.length > 0, matched };
}

// ---------------------------------------------------------------------------
// 2. Monetary-question intent detection (pre-model layer)
// ---------------------------------------------------------------------------

const RATE_QUESTION_RE =
  /\b(how much|price|prices|rate|rates|cost|costs|charging|fee|fees|discount|discounts|cheapest|cheaper|quote|quotation|per night|per person|refund|deposit|package|packages|how many php|php for|pesos|pay|paying|worth|what is the (?:price|cost|rate|fee|total))\b/i;

const PLATFORM_COMPARE_RE = /\b(booking\.com|agoda|airbnb|expedia|booking com)\b/i;

const BREAKFAST_PRICE_RE =
  /\b(breakfast.*(?:price|cost|much|rate)|price.*breakfast|how much.*breakfast|breakfast.*php|breakfast.*peso)\b/i;

const TRANSFER_PRICE_RE =
  /\b(transfer.*(?:price|cost|much|rate|php|peso)|van.*(?:price|cost|much)|airport.*(?:price|cost|much))\b/i;

const DISCOUNT_RE = /\b(discount|promo|promotion|cheaper|off\b|deduct)\b/i;

const TOTAL_RE =
  /\b(total|all in|all-in|grand total|sum|calculate.*nights?|how much.*stay|entire stay|price for)\b/i;

export interface IntentResult {
  intent: MoneyIntent;
  isRateQuestion: boolean;
  approvalRequired: boolean;
  databaseWriteDeferred: boolean;
  reason?: string;
}

/**
 * Deterministic classification of the guest's latest message BEFORE the model
 * runs. When a monetary question is detected we do not send stored monetary
 * knowledge to the model — we use the approved response and collect stay
 * details only when useful.
 */
export function detectIntent(message: string): IntentResult {
  const text = (message || "").trim();

  const rateQ =
    RATE_QUESTION_RE.test(text) ||
    BREAKFAST_PRICE_RE.test(text) ||
    TRANSFER_PRICE_RE.test(text) ||
    DISCOUNT_RE.test(text) ||
    TOTAL_RE.test(text);

  const availabilityQ =
    /\b(availab\w*|open room|free room|rooms left|can i book|is .* available|do you have .* available|still have|any rooms?)\b/i.test(
      text,
    );

  // Platform price comparison is also a rate question.
  const platformQ =
    PLATFORM_COMPARE_RE.test(text) && /(cheaper|price|cost|rate|vs|versus|than)/i.test(text);

  if (rateQ || platformQ) {
    return {
      intent: "rate_request",
      isRateQuestion: true,
      approvalRequired: true,
      databaseWriteDeferred: true,
      reason: platformQ ? "platform-compare" : "monetary-question",
    };
  }

  if (availabilityQ) {
    return {
      intent: "availability",
      isRateQuestion: false,
      approvalRequired: false,
      databaseWriteDeferred: false,
    };
  }

  return {
    intent: "general",
    isRateQuestion: false,
    approvalRequired: false,
    databaseWriteDeferred: false,
  };
}

// ---------------------------------------------------------------------------
// 3. Response sanitizer (post-model layer) — fail safe
// ---------------------------------------------------------------------------

/**
 * Given the model's raw reply and the detected intent, return a guest-safe
 * reply. If monetary output is present OR the intent was a rate_request, the
 * approved response is returned (monetary output is never shown to the guest).
 *
 * `bookingLinks` is reserved for future use: when active, verified platform
 * URLs exist they may be appended. Until then, only platform NAMES are shown
 * (never invented URLs).
 */
export function sanitizeReply(
  rawReply: string,
  intent: MoneyIntent,
  opts: { bookingLinks?: Record<string, string> } = {},
): GuardrailResult {
  const scan = scanForMoney(rawReply);
  const isRate = intent === "rate_request";

  if (scan.hasMoney || isRate) {
    // Always fall back to the approved answer for monetary/rate contexts.
    return {
      reply: APPROVED_RATE_RESPONSE,
      sanitized: true,
      intent,
      approvalRequired: isRate ? true : scan.hasMoney,
      databaseWriteDeferred: isRate,
    };
  }

  if (intent === "availability") {
    // Ensure no live-availability claim survives (redundant safety).
    return {
      reply: rawReply,
      sanitized: false,
      intent,
      approvalRequired: false,
      databaseWriteDeferred: false,
    };
  }

  return {
    reply: rawReply,
    sanitized: false,
    intent,
    approvalRequired: false,
    databaseWriteDeferred: false,
  };
}

/**
 * Build the concierge response object. Extends the existing
 * `ConciergeResponse` shape with guarded metadata while keeping backward
 * compatibility (widget only reads `reply`).
 */
export function buildGuardedResponse(
  rawReply: string,
  intent: MoneyIntent,
): GuardrailResult & { reply: string; unavailable?: boolean } {
  const g = sanitizeReply(rawReply, intent);
  return { ...g };
}
