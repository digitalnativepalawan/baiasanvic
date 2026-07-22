/**
 * Deterministic known-topic answering (SERVER-ONLY).
 *
 * This is what makes the concierge work WITHOUT any LLM provider. The guest
 * flow is:
 *   guest message
 *   -> detect qualified lead and save it        (concierge.leads.ts)
 *   -> detect price question and refuse it      (concierge.guardrails.ts)
 *   -> answer known BAIA topics deterministically (THIS FILE)
 *   -> use Onyx/OpenRouter only for unknown questions
 *   -> otherwise return BAIA contact fallback
 *
 * Onyx and OpenRouter are optional quality enhancers for open-ended
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
  const sentences = chunk.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    // Drop bare section headers like "FOOD & DINING" / "POLICIES & FAQ"
    // (all-caps, no lowercase letters) — they read fine inline but are
    // redundant once several are strung into one paragraph.
    .filter((line) => /[a-z]/.test(line))
    .filter(Boolean)
    .filter(Boolean)
    // Per-line money guard: strip currency/amounts, then drop any line
    // that still trips the obvious-money heuristic (phrases like
    // "deposit", "per adult", "₱6,000"). This keeps the rest of the
    // topic — check-in time, wifi speed, van required-info — usable
    // even when a sibling line mentions price.
    .map((line) => stripMonetary(line))
    .filter((line) => line && !hasObviousMoneySignal(line));
  return sentences.join(" ");
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
 * LLM-backed brain (Onyx/OpenRouter) if one is configured, and fall back to
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

