/**
 * LLM dispatch for the concierge. Supports two providers selected by the owner:
 *  - OpenRouter: owner's own API key, server-side only. Prompt caching via
 *    cache_control on the system block so the big knowledge/persona block is
 *    billed once per session, not per message.
 *  - Ollama: local model auto-discovered on the device running the server.
 *
 * Neither path ever sends the key to the browser.
 */
import type { ConciergeConfig, ConciergeMessage } from "./concierge.types";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  // OpenRouter prompt-caching hint (ignored by Ollama).
  cache_control?: { type: "ephemeral" };
}

function toOpenAiMessages(
  system: string,
  history: ConciergeMessage[],
): ChatMessage[] {
  const sys: ChatMessage = { role: "system", content: system };
  // Attach cache_control so the system block is cached by OpenRouter.
  sys.cache_control = { type: "ephemeral" };
  const rest: ChatMessage[] = history.map((m) => ({
    role: m.role === "guest" ? "user" : "assistant",
    content: m.content,
  }));
  return [sys, ...rest];
}

// Retry a model call a few times — OpenRouter/OpenAI free tiers occasionally
// return an empty body on a single request. We retry on empty replies (and on
// 5xx / transient network errors) before surfacing the fallback to the guest.
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Don't retry missing-key / 4xx auth errors — those won't fix themselves.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("API key not configured") || /OpenRouter 4\d\d/.test(msg)) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

async function callOpenRouter(
  cfg: ConciergeConfig,
  messages: ChatMessage[],
): Promise<string> {
  if (!cfg.openrouterApiKey) {
    throw new Error("OpenRouter API key not configured");
  }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.openrouterApiKey}`,
      // OpenRouter: helps route + enables caching metadata.
      "HTTP-Referer": "https://baia-san-vicente-palawan-island.vercel.app",
      "X-Title": "BAIA Concierge",
    },
    body: JSON.stringify({
      model: cfg.openrouterModel || "openai/gpt-4o-mini",
      messages,
      temperature: 0.4,
      max_tokens: 600,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned an empty reply");
  return text;
}

async function callOllama(
  cfg: ConciergeConfig,
  messages: ChatMessage[],
): Promise<string> {
  const base = cfg.ollamaBaseUrl || "http://localhost:11434";
  const res = await fetch(`${base.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.ollamaModel,
      stream: false,
      options: { temperature: 0.4 },
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { message?: { content?: string } };
  const text = json.message?.content?.trim();
  if (!text) throw new Error("Ollama returned an empty reply");
  return text;
}

/** Run the model for one turn. history already includes the latest guest msg. */
export async function runModel(
  cfg: ConciergeConfig,
  system: string,
  history: ConciergeMessage[],
): Promise<string> {
  const messages = toOpenAiMessages(system, history);
  if (cfg.provider === "ollama") {
    return withRetry(() => callOllama(cfg, messages));
  }
  return withRetry(() => callOpenRouter(cfg, messages));
}
