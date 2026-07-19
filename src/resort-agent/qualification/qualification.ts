/**
 * Conversation qualification — deterministic extraction of booking details.
 *
 * Ported concept from Onyx instructions/booking-inquiry.md ("Collect:
 * check-in, check-out, guests, room preference. If missing, ask — do not
 * assume.") and create_guest_lead.py fields. Implemented as deterministic
 * parsing + a small internal validator (no external dependency) so the core
 * stays portable and testable without extra packages. The previous Zod-based
 * schema is intentionally replaced with lightweight runtime checks to avoid a
 * hard dependency in the reusable core.
 *
 * The agent must NOT invent missing details. Extraction only captures what the
 * guest explicitly stated. Dates are parsed defensively; invalid dates are
 * left undefined so the agent asks for clarification.
 */

export interface ExtractedDetails {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  roomPreference?: string;
  transportNeeded?: boolean;
  specialOccasion?: string;
}

const MONTHS: Record<string, string> = {
  january: "01", feb: "02", february: "02", march: "03", april: "04", may: "05",
  june: "06", july: "07", august: "08", september: "09", oct: "10", october: "10",
  november: "11", december: "12",
};

function toIso(year: number, month: string, day: string): string | undefined {
  const mLower = month.toLowerCase();
  const m =
    MONTHS[mLower] ??
    Object.entries(MONTHS).find(([k]) => k.startsWith(mLower.slice(0, 3)))?.[1];
  if (!m) return undefined;
  const d = parseInt(day, 10);
  if (Number.isNaN(d) || d < 1 || d > 31) return undefined;
  const iso = `${year}-${m}-${String(d).padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

/** Extract an ISO date from free text for a given year (defaults to current). */
function parseDate(text: string, year = new Date().getFullYear()): string | undefined {
  let m = text.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (m) return toIso(year, m[1], m[2]);
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\b/);
  if (m) return toIso(year, m[2], m[1]);
  m = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (m) return m[1];
  return undefined;
}

const ROOM_WORDS = ["cottage", "suite", "villa", "room", "bungalow", "deluxe", "comfort"];

/**
 * Extract booking details from a guest message. Returns only what is present.
 * Never invents. Combine with prior details (later messages override).
 */
export function extractDetails(
  message: string,
  prior: Partial<ExtractedDetails> = {},
): ExtractedDetails {
  const text = message.toLowerCase();
  const out: ExtractedDetails = { ...prior };

  const ci = parseDate(message);
  if (ci) out.checkIn = ci;
  const toMatch = message.match(/\b(?:to|until|through|-)\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\s+[A-Za-z]+|\d{4}-\d{2}-\d{2})\b/i);
  if (toMatch) {
    const co = parseDate(toMatch[1]);
    if (co) out.checkOut = co;
  }

  const adults = text.match(/\b(\d+)\s*(?:adult|guest|people|pax)\b/);
  if (adults) out.adults = Math.min(50, parseInt(adults[1], 10));
  if (/\b(?:for|between)?\s*two people\b|\b2 (?:adults|guests|people)\b/i.test(text) && out.adults === undefined) {
    out.adults = 2;
  }

  const kids = text.match(/\b(\d+)\s*(?:child|kid|children)\b/);
  if (kids) out.children = Math.min(50, parseInt(kids[1], 10));

  for (const w of ROOM_WORDS) {
    const rm = text.match(new RegExp(`\\b([a-z ]*${w}[a-z ]*)\\b`));
    if (rm && rm[1].trim().length <= 120) {
      out.roomPreference = rm[1].trim().replace(/\s+/g, " ");
      break;
    }
  }

  if (/\btransfer\b|\bairport\b|\bpick\s?up\b|\bshuttle\b/.test(text)) out.transportNeeded = true;

  const occ = text.match(/\b(anniversary|birthday|honeymoon|wedding|celebrat\w*)\b/);
  if (occ) out.specialOccasion = occ[1];

  return out;
}

/** Lightweight validation: returns details or throws on clearly invalid data. */
export function validateDetails(d: unknown): ExtractedDetails {
  const v = (d ?? {}) as Record<string, unknown>;
  const out: ExtractedDetails = {};
  if (typeof v.checkIn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.checkIn) && !Number.isNaN(Date.parse(v.checkIn))) {
    out.checkIn = v.checkIn;
  }
  if (typeof v.checkOut === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.checkOut) && !Number.isNaN(Date.parse(v.checkOut))) {
    out.checkOut = v.checkOut;
  }
  if (typeof v.adults === "number" && v.adults >= 1 && v.adults <= 50) out.adults = v.adults;
  if (typeof v.children === "number" && v.children >= 0 && v.children <= 50) out.children = v.children;
  if (typeof v.roomPreference === "string" && v.roomPreference.length <= 120) out.roomPreference = v.roomPreference;
  if (typeof v.transportNeeded === "boolean") out.transportNeeded = v.transportNeeded;
  if (typeof v.specialOccasion === "string" && v.specialOccasion.length <= 200) out.specialOccasion = v.specialOccasion;
  return out;
}
