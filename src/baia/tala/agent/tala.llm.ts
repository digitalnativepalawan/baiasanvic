/**
 * TALA LLM dispatch with TOOL CALLING (SERVER-ONLY).
 *
 * Extends the legacy single-pass dispatch (concierge.llm.ts) with the OpenAI
 * tool-calling protocol so TALA can act, not just answer:
 *
 *   model → tool_calls → execute tools (tala.tools.ts) → feed results back →
 *   model → ... → final reply
 *
 * Two providers, selected by the owner's existing concierge config:
 *   - OpenRouter: any model that supports the OpenAI tools API.
 *   - Ollama: local models via /api/chat (supports the same tool shape since
 *     Ollama 0.3).
 *
 * The key never leaves the server. Every function here is transport-level
 * only — guardrails live in concierge.guardrails.ts and the loop
 * (tala.loop.ts).
 */
import type { ConciergeConfig, ConciergeMessage } from "../../concierge.types";
import { resolveOllamaModel } from "../../concierge.discovery";

/** OpenAI-style tool definition (also accepted by Ollama). */
export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

/** One tool call requested by the model. `arguments` is a JSON string. */
export interface ModelToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** Messages exchanged inside the agentic loop (richer than guest/agent pairs). */
export interface LoopMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Present on assistant messages that requested tool calls. */
  tool_calls?: ModelToolCall[];
  /** Present on tool messages; links the result to the call. */
  tool_call_id?: string;
  /** Tool name on tool messages (Ollama uses this). */
  name?: string;
}

export interface LoopTurnResult {
  content: string;
  toolCalls: ModelToolCall[];
}

const REQUEST_TIMEOUT_MS = 45_000;

function withTimeout(): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

/** Map guest/agent history into loop messages (user/assistant). */
export function historyToLoopMessages(history: ConciergeMessage[]): LoopMessage[] {
  return history.map((m) => ({
    role: m.role === "guest" ? "user" : "assistant",
    content: m.content,
  }));
}

/** Normalize a provider tool_calls array into our ModelToolCall shape. */
function normalizeToolCalls(raw: unknown): ModelToolCall[] {
  if (!Array.isArray(raw)) return [];
  const out: ModelToolCall[] = [];
  for (let i = 0; i < raw.length; i++) {
    const tc = raw[i] as {
      id?: string;
      function?: { name?: string; arguments?: unknown };
    };
    const name = tc?.function?.name;
    if (!name) continue;
    // OpenRouter sends a JSON string; Ollama sends a parsed object.
    const rawArgs = tc?.function?.arguments;
    let args = "{}";
    if (typeof rawArgs === "string") args = rawArgs;
    else if (rawArgs !== undefined && rawArgs !== null) args = JSON.stringify(rawArgs);
    out.push({ id: tc?.id || `call_${i}_${Date.now()}`, name, arguments: args });
  }
  return out;
}

async function openRouterWithTools(
  cfg: ConciergeConfig,
  messages: LoopMessage[],
  tools: ToolSchema[],
): Promise<LoopTurnResult> {
  const body: Record<string, unknown> = {
    model: cfg.openrouterModel || "openai/gpt-4o-mini",
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content || "",
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    })),
    temperature: 0.4,
    max_tokens: 1200,
  };
  if (tools.length > 0) body.tools = tools;

  const { signal, done } = withTimeout();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.openrouterApiKey}`,
        "HTTP-Referer": "https://baiasanvic.lovable.app",
        "X-Title": "TALA Agent",
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: {
        message?: { content?: string; tool_calls?: unknown };
      }[];
    };
    const msg = json.choices?.[0]?.message;
    return {
      content: (msg?.content ?? "").trim(),
      toolCalls: normalizeToolCalls(msg?.tool_calls),
    };
  } finally {
    done();
  }
}

async function ollamaWithTools(
  cfg: ConciergeConfig,
  messages: LoopMessage[],
  tools: ToolSchema[],
): Promise<LoopTurnResult> {
  const base = (cfg.ollamaBaseUrl || "http://localhost:11434").replace(/\/$/, "");
  const body: Record<string, unknown> = {
    model: cfg.ollamaModel,
    stream: false,
    options: { temperature: 0.4 },
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content || "",
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    })),
  };
  if (tools.length > 0) body.tools = tools;

  const { signal, done } = withTimeout();
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      message?: { content?: string; tool_calls?: unknown };
    };
    return {
      content: (json.message?.content ?? "").trim(),
      toolCalls: normalizeToolCalls(json.message?.tool_calls),
    };
  } finally {
    done();
  }
}

export type ProviderKind = "openrouter" | "ollama";

/** Is a provider actually usable with this config (key present / model set)? */
export function providerUsable(cfg: ConciergeConfig): ProviderKind | null {
  if (cfg.provider === "openrouter" && (cfg.openrouterApiKey || "").trim().length >= 20) {
    return "openrouter";
  }
  if (cfg.provider === "ollama" && (cfg.ollamaModel || "").trim()) {
    return "ollama";
  }
  return null;
}

/** One model call inside the loop. Throws on transport/auth errors. */
export async function callModelWithTools(
  provider: ProviderKind,
  cfg: ConciergeConfig,
  messages: LoopMessage[],
  tools: ToolSchema[],
): Promise<LoopTurnResult> {
  return provider === "ollama"
    ? ollamaWithTools(cfg, messages, tools)
    : openRouterWithTools(cfg, messages, tools);
}

/**
 * Build the loop's model function from the owner's config. Auto-discovers an
 * Ollama model when the provider is ollama and no model name is saved.
 * Returns null when no provider is usable — callers must then use the
 * deterministic path so TALA still answers.
 */
export async function makeModelFn(
  cfg: ConciergeConfig,
): Promise<((m: LoopMessage[], t: ToolSchema[]) => Promise<LoopTurnResult>) | null> {
  let provider = providerUsable(cfg);
  if (!provider) return null;
  if (provider === "ollama" && !cfg.ollamaModel?.trim()) {
    const model = await resolveOllamaModel(cfg.ollamaBaseUrl, cfg.ollamaModel).catch(() => null);
    if (!model) return null;
    cfg = { ...cfg, ollamaModel: model };
  }
  return (m, t) => callModelWithTools(provider!, cfg, m, t);
}
