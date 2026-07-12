/**
 * Cheap, dependency-free retrieval so a million questions don't blow up the
 * prompt (and the token bill). We score the user's latest question against
 * each knowledge chunk with keyword overlap and inject only the best matches —
 * not the entire knowledge base on every turn.
 */
import { buildStaticChunks, KnowledgeChunk } from "./concierge.knowledge";

const STATIC_CHUNKS = buildStaticChunks();

// Words we ignore when scoring (too generic to be useful).
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "at", "for", "is",
  "are", "i", "we", "you", "my", "our", "your", "with", "can", "do", "does",
  "what", "when", "where", "how", "be", "it", "this", "that", "have", "has",
  "want", "would", "could", "please", "hi", "hello", "hey", "thanks", "thank",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

const CHUNK_TOKEN_INDEX: { chunk: KnowledgeChunk; tokens: Map<string, number> }[] =
  STATIC_CHUNKS.map((chunk) => {
    const tokens = new Map<string, number>();
    for (const t of tokenize(chunk.text)) {
      tokens.set(t, (tokens.get(t) ?? 0) + 1);
    }
    return { chunk, tokens };
  });

/**
 * Returns the most relevant chunks for a question, plus a relevance score.
 * Always returns at least the "about" + "booking" chunks as a safe baseline so
 * the agent can always point guests to book / contact even on vague questions.
 */
export function retrieveRelevant(question: string, customKnowledge = ""): {
  chunks: KnowledgeChunk[];
  score: number;
} {
  const qTokens = tokenize(question);
  const scored = CHUNK_TOKEN_INDEX.map(({ chunk, tokens }) => {
    let score = 0;
    for (const qt of qTokens) {
      const hit = tokens.get(qt);
      if (hit) score += hit;
    }
    return { chunk, score };
  });

  // Strong matches first; keep everything with a positive score.
  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.chunk);

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
      text: customKnowledge.trim(),
    });
  }

  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
  return { chunks, score: totalScore };
}

/** Flatten selected chunks into the context block the LLM sees. */
export function chunksToText(chunks: KnowledgeChunk[]): string {
  return chunks.map((c) => `## ${c.label}\n${c.text}`).join("\n\n");
}
