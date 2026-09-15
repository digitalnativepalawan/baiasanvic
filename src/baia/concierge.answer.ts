/**
 * Deterministic known-topic answering (SERVER-ONLY).
 *
 * This is what makes the concierge work WITHOUT any LLM provider. The guest
 * flow is:
 *   guest message
 *   -> detect qualified lead and save it        (concierge.leads.ts)
 *   -> detect price question and refuse it      (concierge.guardrails.ts)
 *   -> answer known BAIA topics deterministically (THIS FILE)
 *   -> use the TALA agentic loop for unknown questions
 *   -> otherwise return BAIA contact fallback
 *
 * The LLM loop is an optional quality enhancer for open-ended
 * questions the static knowledge base doesn't confidently cover. They must
 * never be a requirement for the concierge to answer BAIA's own core
 * topics: location, rooms, dining/menu, transport, experiences, booking
 * instructions, stay details, families, and nearby town info. All of that
 * knowledge already lives in concierge.knowledge.ts as owner-approved,
 * price-stripped static text — this module just decides WHEN we are
 * confident enough in a keyword match to answer from it directly, with no
 * model call at all.
 */
import { scoreChunks } from "./concierge.retrieve";
import { buildStaticChunks, type KnowledgeChunk } from "./concierge.knowledge";
import { stripMonetary, isMenuQuestion, buildMenuAnswer } from "./concierge.knowledge";
import { hasObviousMoneySignal } from "./concierge.guardrails";

/**
 * Minimum keyword-overlap score required before we trust a static chunk
 * enough to answer from it directly (no model). Score of 1 means at least
 * one distinct, non-generic term from the guest's question appears in that
 * chunk. Below this, admit "I don't know" and let the enhancer / contact
 * fallback take over rather than guess.
 */
const MIN_CONFIDENT_SCORE = 1;

/**
 * Every static chunk id produced by buildStaticChunks() is eligible for
 * deterministic answering — plus the ad-hoc "custom" chunk id used for
 * owner-authored extra knowledge. Derived once at module load so new owner
 * topics added to concierge.knowledge.ts are picked up automatically.
 */
const KNOWN_TOPIC_IDS = new Set<string>([
  ...buildStaticChunks().map((c) => c.id),
  "custom",
]);

/**
 * Turn a knowledge chunk's structured text (e.g. "ROOM: Deluxe\nSleeps:
 * 2\n...") into a flowing, guest-facing paragraph. Field-style labels like
 * "ROOM:", "Sleeps:", "TRANSFERS & GETTING HERE" are stripped so the reply
 * reads like a sentence, not a spec sheet.
 */
function formatChunkForGuest(chunk: KnowledgeChunk): string {
  const lines = chunk.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const raw of lines) {
    // Strip monetary tokens on every line first (defense in depth).
    const line = stripMonetary(raw);
    if (!line) continue;
    if (hasObviousMoneySignal(line)) continue;

    // Markdown-style heading lines become their own paragraph.
    if (/^#{1,3}\s/.test(line)) {
      out.push(`\n${line.replace(/^#+\s+/, "").trim()}\n`);
      continue;
    }
    // Bullet lines stay as bullets (two-space indent so they sit under a heading).
    if (/^[-*]\s/.test(line)) {
      out.push(`  ${line.replace(/^[-*]\s+/, "")}`);
      continue;
    }
    // Keep real content lines (they contain at least one lowercase letter).
    if (/[a-z]/.test(line)) {
      out.push(line);
      continue;
    }
    // Bare all-caps banners / anything else — keep as a short separator line.
    out.push(line);
  }
  return out.join("\n").trim();
}

export interface DeterministicAnswer {
  reply: string;
  topicId: string;
  label: string;
}

/**
 * Answer a guest question directly from BAIA's approved static knowledge
 * when we're confident which topic it's about. Returns null when no chunk
 * clears the confidence bar — callers should then try an optional
 * LLM-backed agentic loop (TALA) if a provider is configured, and fall back to
 * the contact message if not.
 *
 * Defense in depth: even though the source chunks are already price-free by
 * construction (see concierge.knowledge.ts), the formatted reply is passed
 * through stripMonetary() and re-checked with hasObviousMoneySignal() before
 * use, so a future edit to a chunk's text can never leak a price here. We
 * deliberately use the lighter obvious-signal check (currency symbols/codes,
 * explicit price phrases) rather than the strict scanForMoney() used for raw
 * model output — scanForMoney's bare-number-range heuristic would false-
 * positive on completely price-free content like "30–40 minutes away" or
 * "2:00 PM to 12:00 PM", which appear throughout BAIA's real static
 * knowledge.
 */
export function answerKnownTopic(
  question: string,
  extraChunks: KnowledgeChunk[] = [],
): DeterministicAnswer | null {
  const q = (question || "").trim();
  if (!q) return null;

  // Food/dining/menu questions get BAIA's dedicated, richer menu answer
  // (already reviewed, no prices, explicitly built for this exact case) —
  // this is more reliable than generic keyword scoring against the dining
  // knowledge chunk, which can miss synonyms like "dinner" or "lunch" that
  // don't happen to appear verbatim in the source text.
  if (isMenuQuestion(q)) {
    return { reply: buildMenuAnswer(), topicId: "dining", label: "Food & dining" };
  }

  // Admin-authored DB knowledge is trusted the same way static chunks are.
  const knownIds = new Set<string>([...KNOWN_TOPIC_IDS, ...extraChunks.map((c) => c.id)]);
  const scored = scoreChunks(q, extraChunks);
  const top = scored.find((s) => knownIds.has(s.chunk.id));
  if (!top || top.score < MIN_CONFIDENT_SCORE) return null;

  const formatted = stripMonetary(formatChunkForGuest(top.chunk));
  if (!formatted) return null;

  // Fail safe: if an unambiguous money signal survived formatting, do not
  // answer deterministically — let the rate-question layer handle it instead.
  if (hasObviousMoneySignal(formatted)) return null;

  return { reply: formatted, topicId: top.chunk.id, label: top.chunk.label };
}

/**
 * Derive a few contextual follow-up questions from the chunk that answered the
 * guest, so the conversation carries forward even with no LLM provider.
 * Deterministic, inexpensive, and on-topic: each follow-up is a short question
 * the guest can tap. When nothing credible can be derived, returns an empty
 * array (the widget then shows nothing).
 */
export function suggestFollowUps(chunkId: string, label: string): string[] {
  const out: string[] = [];
  // Topic-driven follow-ups — the guest just asked about X, here are natural
  // next questions they might want to ask next.
  switch (chunkId) {
    case "accommodations":
      out.push("Which room suits 2 adults + 1 child?");
      out.push("Do you have a beachfront room available?");
      out.push("What's the smallest room you have?");
      break;
    case "experiences":
      out.push("Can you arrange a half-day island-hopping charter?");
      out.push("Where's the best spot for snorkeling near BAIA?");
      out.push("Do you offer sunrise yoga?");
      break;
    case "dining":
      out.push("Do you accommodate vegetarian meals?");
      out.push("Can we have a private beach dinner?");
      out.push("What time is breakfast served?");
      break;
    case "booking":
      out.push("What dates are you looking at?");
      out.push("Which room type do you prefer?");
      out.push("How do I reach the team by email?");
      break;
    case "transfers":
      out.push("How long is the drive from Puerto Princesa?");
      out.push("How much notice do you need for the van?");
      out.push("Can the outrigger pick me up from the beach?");
      break;
    case "stay":
      out.push("What time is check-in and check-out?");
      out.push("Is WiFi reliable in the villas?");
      out.push("Is BAIA good for a digital nomad stay?");
      break;
    case "family":
      out.push("Can the Deluxe Suite sleep 4?");
      out.push("Do you provide a crib?");
      out.push("Is the beach safe for children?");
      break;
    case "town":
      out.push("How do I get to Port Barton?");
      out.push("Is there an ATM in San Vicente town?");
      out.push("What restaurants are near BAIA?");
      break;
    case "breakfast":
      out.push("What time is breakfast served?");
      out.push("Can I get breakfast in my villa?");
      out.push("Do you have vegetarian breakfast options?");
      break;
    case "checkin_checkout":
      out.push("Can I arrive earlier than 2 PM?");
      out.push("How do I arrange a late check-in?");
      out.push("Can you store my luggage if I arrive early?");
      break;
    case "cancellation":
      out.push("What's BAIA's cancellation policy?");
      out.push("How far in advance do I need to cancel?");
      out.push("What if I no-show?");
      break;
    case "airport_transfer":
      out.push("How long is the drive from PPS?");
      out.push("How much notice do you need for the van?");
      out.push("Can you pick up more than 12 guests?");
      break;
    case "tour_partners":
      out.push("Do you offer a half-day island-hopping charter?");
      out.push("Where's the best place to see turtles?");
      out.push("Can you arrange a beach lunch on the sandbar?");
      break;
    case "rentals":
      out.push("How much is a scooter per day?");
      out.push("Can I rent a bicycle to ride to Long Beach?");
      out.push("Do you have bikes for adults and children?");
      break;
    case "wifi":
      out.push("Is the WiFi reliable for video calls?");
      out.push("Is there a backup if the WiFi drops?");
      out.push("Is the WiFi free?");
      break;
    case "power":
      out.push("How often does the power go out?");
      out.push("Is there backup power for the AC?");
      out.push("What should I pack for power outages?");
      break;
    case "faqs":
      out.push("How do I get an exact package total?");
      out.push("What dates are you looking at?");
      out.push("Which room type do you prefer?");
      break;
    case "long_beach":
      out.push("How do I get to Long Beach from BAIA?");
      out.push("What time is best to go?");
      out.push("Can I take a scooter there?");
      break;
    case "port_barton":
      out.push("How do I get to Port Barton?");
      out.push("Can you recommend restaurants there?");
      out.push("Can Port Barton be combined with a waterfall day-trip?");
      break;
    case "island_hopping":
      out.push("Can you arrange a half-day charter?");
      out.push("Which island has the best beach lunch?");
      out.push("Do turtles show up reliably?");
      break;
    case "waterfalls":
      out.push("Which waterfall is easiest to reach?");
      out.push("Can I combine a waterfall with Port Barton?");
      out.push("Do I need a guide for Pamuayan Falls?");
      break;
    case "alimanguan_surfing":
      out.push("How do I get to Alimanguan from BAIA?");
      out.push("What's the best season for surfing there?");
      out.push("Do you have surf board rentals?");
      break;
    case "seasons":
      out.push("When is the best time to visit BAIA?");
      out.push("Is June to October a good time to go?");
      out.push("Are boat trips still running in the rainy season?");
      break;
    case "packing":
      out.push("What sunscreen should I bring?");
      out.push("Do I need reef shoes?");
      out.push("Should I bring cash to San Vicente?");
      break;
    case "health_safety":
      out.push("Where's the nearest medical help?");
      out.push("Is travel insurance recommended?");
      out.push("Is tap water safe to drink?");
      break;
    case "nomads":
      out.push("Is the WiFi good enough for remote work?");
      out.push("Do you offer long-stay rates?");
      out.push("Is there a workspace at BAIA?");
      break;
    case "special_occasions":
      out.push("Can you arrange a beachfront proposal?");
      out.push("Can we have a private candle-lit dinner?");
      out.push("How far in advance should I ask?");
      break;
    case "wellness":
      out.push("What time is the sunrise yoga session?");
      out.push("Can you arrange a massage?");
      out.push("Is the shala open outside scheduled sessions?");
      break;
    case "sustainability":
      out.push("Do you have reef-safe sunscreen?");
      out.push("What are the marine park rules?");
      out.push("Can I bring my own refillable bottle?");
      break;
    case "payments":
      out.push("How do I pay for my stay?");
      out.push("Is a deposit required?");
      out.push("Do you list on Booking.com and Agoda?");
      break;
    case "house_rules":
      out.push("Are pets allowed at BAIA?");
      out.push("Can we have a small party in our villa?");
      out.push("Is smoking allowed on the property?");
      break;
    case "culture":
      out.push("What languages do the staff speak?");
      out.push("What's a nice Filipino phrase I can use?");
      out.push("Is tipping expected?");
      break;
    default:
      break;
  }
  return out.slice(0, 4);
}

