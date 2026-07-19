/**
 * Builds the concierge's knowledge pack from the resort's existing site data
 * (rooms, activities, attractions) plus the owner's editable extras.
 *
 * IMPORTANT: prices are intentionally redacted from the knowledge the agent
 * sees. The concierge never quotes rates — it directs guests to the Book Now
 * / inquiry links. This is enforced both by stripping numbers here and by the
 * guardrail in the system prompt.
 */
import { ROOMS, ATTRACTIONS, ACTIVITIES } from "./data";

export interface KnowledgeChunk {
  id: string;
  label: string;
  text: string;
}

/**
 * Strip any monetary tokens from a knowledge string before it reaches the
 * guest-facing prompt. Defense in depth: even if a future knowledge source or
 * owner custom-knowledge field contains a price, it never reaches the model.
 * Currency symbols/codes, "per night", amounts, and ranges are removed.
 */
const MONETARY_RE =
  /(₱|\$|€|£|¥|\bphp\b|\busd\b|\beur\b|\bgbp\b|\bpesos?\b)\s?-?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:php|usd|eur|gbp|pesos?)|per\s?night|per\s?person|nightly\s+rate|price\s*:?|rate\s*:?\s*₱?\d[\d,]*|starting\s+from|starts\s+at\s*₱?\d[\d,]*/gi;

export function stripMonetary(text: string): string {
  if (!text) return text;
  const cleaned = text
    .replace(MONETARY_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
}

function roomChunkText(): string {
  const lines = ROOMS.map((r) => {
    // Inventory count is property inventory ONLY — never current availability.
    const inventory = r.availabilityCount ?? 0;
    return [
      `ROOM: ${r.name}`,
      `Sleeps: ${r.capacity}`,
      `Size: ${r.size}`,
      `Description: ${r.description}`,
      `Amenities: ${r.amenities.join(", ")}`,
      `Property inventory: ${inventory} unit(s) of this room type. Current availability requires confirmation.`,
    ].join("\n");
  });
  return lines.join("\n\n");
}

function experienceChunkText(): string {
  const activities = ACTIVITIES.map((a) => {
    return [
      `EXPERIENCE: ${a.title} (${a.category}, ${a.difficulty}, ${a.duration})`,
      a.description,
    ].join("\n");
  });
  const attractions = ATTRACTIONS.map((at) => {
    return [
      `NEARBY: ${at.name} — ${at.category}, ${at.distanceFromResort}`,
      at.description,
      `Tip: ${at.tips}`,
    ].join("\n");
  });
  return [...activities, ...attractions].join("\n\n");
}

function bookingChunkText(): string {
  return [
    "BOOKING & CONTACT",
    "Guests book through the 'Book Your Stay' button or the inquiry form on the site. The resort follows up by email to confirm rates and availability — no payment is taken online.",
    "Contact: hello@baiapalawan.com",
    "Location: Penanindigan Beach, San Vicente, Palawan, Philippines.",
    "Check-in / check-out times are confirmed by the resort after inquiry. Early check-in or late check-out can be requested and are subject to availability.",
    "If a guest wants to reserve, ask for their name, email, dates, number of guests, and which room type they prefer, then tell them to use the Book Now button (or you can summarize their request so they can paste it into the inquiry form).",
  ].join("\n");
}

function aboutChunkText(): string {
  return [
    "ABOUT BAIA",
    "BAIA Beachfront Boutique Lodge is a barefoot-luxury retreat on Penanindigan Beach, San Vicente, Palawan — a slower pace of life surrounded by raw natural beauty, turquoise tidal pools, and warm Filipino island hospitality.",
    "Philosophy: 'True luxury is feeling completely at home in nature.' Simplicity becomes riches; raw tropical beauty is framed by custom design and hospitality.",
    "The resort offers private, single-level villas in a tropical-minimalist style — calm, timber, and open to the breeze. Every room includes air conditioning, a flat-screen TV, a private bathroom, and hot water.",
  ].join("\n");
}

function policyChunkText(): string {
  return [
    "POLICIES & FAQ",
    "Rates and availability are confirmed by the resort over email after an inquiry — do not quote specific prices.",
    "Cancellations and changes are handled by the resort directly via email.",
    "The resort can arrange private outrigger boat charters, island-hopping, wellness sessions, and bespoke experiences (proposals, detox programs, etc.) — recommend the guest describe what they dream of and the concierge team will tailor it.",
    "Family friendly and suitable for couples seeking privacy. Pets policy is confirmed with the resort.",
    "Getting here: San Vicente is reached via Puerto Princesa (flights) then a scenic transfer; the resort can advise on the best route after an inquiry.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Owner-authored knowledge base.
//
// Add more topics over time by appending a { id, label, text } entry to
// OWNER_KNOWLEDGE below — the concierge will pick them up automatically via
// retrieveRelevant(). Keep ids unique. Prices stay out of here by design
// (the bot never quotes rates). The admin panel's "Extra knowledge" box is
// still appended on top of all of this at request time.
// ---------------------------------------------------------------------------
function diningChunkText(): string {
  return [
    "FOOD & DINING",
    "BAIA has an on-site restaurant serving Filipino and Western dishes, with fresh seafood from the day's catch.",
    "Breakfast is available for guests (continental and cooked options).",
    "In-villa or beachfront private dining can be arranged for special occasions — just ask the concierge.",
    "We accommodate vegetarian, vegan, and most dietary needs if told in advance. Fresh fruit and coconut water are daily staples.",
  ].join("\n");
}

function transfersChunkText(): string {
  return [
    "TRANSFERS & GETTING HERE",
    "We can arrange a private van transfer from Puerto Princesa International Airport (PPS) — about 2.5 to 3 hours by road to San Vicente.",
    "Flights to PPS run daily from Manila and Cebu.",
    "For island guests, our outrigger picks you up right on BAIA's shoreline. Tell us your flight time and we'll coordinate the pickup.",
  ].join("\n");
}

function stayChunkText(): string {
  return [
    "STAY DETAILS",
    "Standard check-in is 2:00 PM; check-out is 12:00 PM. Early check-in or late check-out can be requested and is subject to availability — we'll confirm by email. We can safely hold luggage if you arrive early.",
    "What's included: daily housekeeping, WiFi in common areas, beach loungers, use of the beachfront shala, and the complimentary sunrise vinyasa & sound healing session. Government taxes are included in the quoted rate.",
    "WiFi is free in the restaurant and common areas; signal in the villas is fair but lighter — this is a place to unplug. Mobile signal (Globe/Smart) reaches most of the property.",
    "We don't take payment online. After your inquiry we confirm availability and send bank-transfer / PayPal details, or you may pay cash on arrival. A deposit may be requested to hold peak-season dates.",
    "Best time to visit: Palawan's dry season is roughly November to May (sunniest, calmest seas). June to October is greener with occasional rain; boat trips still run but check the weather. Pack reef-safe sunscreen, light clothing, reef shoes, and a light jacket for breezy evenings.",
  ].join("\n");
}

function familyChunkText(): string {
  return [
    "FAMILIES & KIDS",
    "Family-friendly and great for couples seeking privacy. Rollaway beds available in the Comfort Cottage (sleeps 3); the Deluxe Beachfront Suite sleeps 4 with a sofa bed.",
    "We can provide a crib on request. Kid-friendly meals can be prepared.",
    "The beach is gentle but always supervise children near the water.",
  ].join("\n");
}

function townChunkText(): string {
  return [
    "NEARBY TOWN & OFF-SITE",
    "San Vicente town (10 min drive) has a small ATM, sari-sari stores, and a few local eateries.",
    "Port Barton (30–40 min by boat) has casual beachfront restaurants — we're happy to point you to our favorites.",
  ].join("\n");
}

// Topics the owner authors over time. Append new entries here (unique id!).
const OWNER_TOPICS: { id: string; label: string; text: string }[] = [
  { id: "dining", label: "Food & dining", text: diningChunkText() },
  { id: "transfers", label: "Transfers & getting here", text: transfersChunkText() },
  { id: "stay", label: "Stay details", text: stayChunkText() },
  { id: "family", label: "Families & kids", text: familyChunkText() },
  { id: "town", label: "Nearby town", text: townChunkText() },
];

/** Static chunks built once from site data + owner-authored topics. */
export function buildStaticChunks(): KnowledgeChunk[] {
  return [
    { id: "about", label: "About BAIA", text: aboutChunkText() },
    { id: "accommodations", label: "Accommodations", text: roomChunkText() },
    { id: "experiences", label: "Experiences & nearby", text: experienceChunkText() },
    { id: "booking", label: "Booking & contact", text: bookingChunkText() },
    { id: "policies", label: "Policies & FAQ", text: policyChunkText() },
    ...OWNER_TOPICS.map((t) => ({ id: t.id, label: t.label, text: t.text })),
  ];
}
