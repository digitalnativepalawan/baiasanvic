/**
 * Model-provider adapters that wrap the EXISTING BAIA implementations.
 *
 * We do NOT rewrite working provider code. `concierge.llm.ts` already exports
 * `runModel(cfg, system, messages)` for OpenRouter/Ollama. These adapters wrap
 * it behind the provider-agnostic AgentModelProvider interface so the core
 * stays independent of any single provider.
 *
 * The core's runResortAgent does not require a model for the rule-based paths
 * (rate_request, availability, complaints) — it uses deterministic logic. A
 * model is only needed for open-ended general chat, and even then the response
 * is sanitized by the guardrails layer. This preserves OpenRouter + Ollama.
 */
import type { AgentModelInput, AgentModelOutput, AgentModelProvider } from "../core/model-provider.ts";
import type { ConciergeConfig, ConciergeMessage } from "../../baia/concierge.types.ts";
import { runModel } from "../../baia/concierge.llm.ts";

export function createConciergeModelProvider(cfg: ConciergeConfig): AgentModelProvider {
  return {
    async generate(input: AgentModelInput): Promise<AgentModelOutput> {
      // Map the core's neutral message format to the BAIA concierge format.
      const messages: ConciergeMessage[] = input.messages.map((m) => ({
        role: m.role === "assistant" ? "agent" : "guest",
        content: m.content,
      }));
      const text = await runModel(cfg, input.system, messages);
      return { text };
    },
  };
}
