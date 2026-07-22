/**
 * Cheap, dependency-free retrieval so a million questions don't blow up the
 * prompt (and the token bill). We score the user's latest question against
 * each knowledge chunk with keyword overlap and inject only the best matches —
 * not the entire knowledge base on every turn.
 */
import { buildStaticChunks, KnowledgeChunk, stripMonetary } from "./concierge.knowledge";

const STATIC_CHUNKS = buildStaticChunks();

// Words we ignore when scoring (too generic to be useful).
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "is",
  "are",
  "i",
  "we",
  "you",
  "my",
  "our",
  "your",
  "with",
  "can",
  "do",
  "does",
  "what",
  "when",
  "where",
  "how",
  "be",
  "it",
  "this",
  "that",
  "have",
  "has",
  "want",
  "would",
  "could",
  "please",
  "hi",
  "hello",
  "hey",
  "thanks",
  "thank",
  // Brand/domain words that appear throughout almost every chunk.
  "baia",
  "resort",
  "guest",
  "guests",
]);

// Light stemmer: collapse simple English plurals so `rooms` matches `room`,
// `tours` matches `tour`, `dishes` matches `dish`. Only fires on tokens
// > 3 chars so short words like `bus` don't get mangled into `bu`.
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

// Guest-phrasing synonyms expanded ONLY on the question side, so vague
// language ("how do I get there", "is there a shuttle") maps onto the
// terms that actually appear in the chunks.
const SYNONYMS: Record<string, string[]> = {
  there: ["baia", "location", "san", "vicente"],
  here: ["baia", "location"],
  van: ["airport", "transfer"],
  shuttle: ["airport", "transfer"],
  pickup: ["airport", "transfer"],
  ride: ["transfer"],
  airport: ["transfer"],
  flight: ["transfer", "airport"],
  wifi: ["wifi", "internet"],
  internet: ["wifi"],
  kid: ["family"],
  child: ["family"],
  dog: ["pets"],
  cat: ["pets"],
  pet: ["pets"],
  tour: ["tour", "island", "hopping"],
  boat: ["island", "hopping", "outrigger"],
  snorkel: ["island", "hopping", "reef"],
  beach: ["long", "beach", "penanindigan"],
  waterfall: ["waterfall", "pamuayan"],
  surf: ["alimanguan", "surfing"],
  scooter: ["rental"],
  moped: ["rental"],
  bike: ["rental"],
  bicycle: ["rental"],
  rent: ["rental"],
  location: ["location", "san", "vicente"],
  address: ["location", "san", "vicente"],
};

// Intent-level question rewrites — applied BEFORE stopword filtering so
// short guest questions ("Where is BAIA?", "How much?", "Any pets OK?")
// pick up the topic keywords that actually live in the chunks.
const QUESTION_HINTS: Array<{ re: RegExp; add: string[] }> = [
  { re: /\bwhere\b|\blocated\b|\baddress\b|\bmap\b/i, add: ["location", "san", "vicente", "penanindigan"] },
  { re: /\bhow far\b|\bdistance\b/i, add: ["location", "san", "vicente"] },
  { re: /\bwhat time\b|\bwhen.*(check|open|close|arriv|depart)\b/i, add: ["check", "front", "desk"] },
  { re: /\bwho\b/i, add: ["baia", "team"] },
];

function tokenize(text: string, expand = false): string[] {
  let src = text;
  if (expand) {
    for (const h of QUESTION_HINTS) {
      if (h.re.test(src)) src += " " + h.add.join(" ");
    }
  }
  const raw = src
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
  if (!expand) return raw;
  const out = [...raw];
  for (const t of raw) {
    const syn = SYNONYMS[t];
    if (syn) out.push(...syn.map(stem));
  }
  return out;
}

const CHUNK_TOKEN_INDEX: { chunk: KnowledgeChunk; tokens: Map<string, number> }[] =
  STATIC_CHUNKS.map((chunk) => {
    const tokens = new Map<string, number>();
    for (const t of tokenize(chunk.text)) {
      tokens.set(t, (tokens.get(t) ?? 0) + 1);
    }
    return { chunk, tokens };
  });

export interface ScoredChunk {
  chunk: KnowledgeChunk;
  score: number;
}

/**
 * Score every static knowledge chunk against a question by keyword overlap,
 * best match first. Exported so callers that need to know HOW confident a
 * match is (not just the merged text) — e.g. the deterministic known-topic
 * answerer — can apply their own confidence threshold instead of always
 * sending everything to the model.
 */
export function scoreChunks(question: string): ScoredChunk[] {
  const qTokens = tokenize(question, true);
  return CHUNK_TOKEN_INDEX.map(({ chunk, tokens }) => {
    let score = 0;
    for (const qt of qTokens) {
      const hit = tokens.get(qt);
      if (hit) score += hit;
    }
    return { chunk, score };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Returns the most relevant chunks for a question, plus a relevance score.
 * Always returns at least the "about" + "booking" chunks as a safe baseline so
 * the agent can always point guests to book / contact even on vague questions.
 */
export function retrieveRelevant(
  question: string,
  customKnowledge = "",
): {
  chunks: KnowledgeChunk[];
  score: number;
} {
  const scored = scoreChunks(question);

  // Strong matches first; keep everything with a positive score.
  const matched = scored.filter((s) => s.score > 0).map((s) => s.chunk);

  // Baseline safety chunks.
  const baselineIds = new Set(["about", "booking"]);
  const baseline = STATIC_CHUNKS.filter(
    (c) => baselineIds.has(c.id) && !matched.find((m) => m.id === c.id),
  );

  const chunks = [...matched, ...baseline];

  if (customKnowledge.trim()) {
    chunks.push({
      id: "custom",
      label: "Owner knowledge",
      // Sanitize owner custom knowledge: never pass monetary values to the model.
      text: stripMonetary(customKnowledge.trim()),
    });
  }

  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
  return { chunks, score: totalScore };
}

/** Flatten selected chunks into the context block the LLM sees. */
export function chunksToText(chunks: KnowledgeChunk[]): string {
  return chunks.map((c) => `## ${c.label}\n${c.text}`).join("\n\n");
}
