/**
 * Server function: one turn of the concierge conversation.
 *
 * Flow (token-smart):
 *  1. Load config (server-only, may hold the key).
 *  2. Retrieve only the knowledge chunks relevant to the latest guest message.
 *  3. Trim history to the last N turns so the prompt never grows unbounded.
 *  4. Build system prompt with guardrails + the relevant knowledge.
 *  5. Call the selected model (OpenRouter with cache_control, or Ollama).
 *  6. Log both turns (best-effort) and return the reply.
 */
import { createServerFn } from "@tanstack/react-start";
import type { ConciergeConfig, ConciergeMessage, ConciergeResponse } from "./concierge.types";
import { loadConciergeConfig } from "./concierge.config.server";
import { buildSystemPrompt } from "./concierge.prompt";
import { retrieveRelevant, chunksToText } from "./concierge.retrieve";
import { runModel } from "./concierge.llm";
import { resolveOllamaModel } from "./concierge.discovery";
import { logConciergeTurn } from "./concierge.log.server";

const MAX_HISTORY_TURNS = 10;

function trimHistory(messages: ConciergeMessage[]): ConciergeMessage[] {
  // Keep the most recent MAX_HISTORY_TURNS * 2 messages (guest+agent pairs).
  const limit = MAX_HISTORY_TURNS * 2;
  if (messages.length <= limit) return messages;
  return messages.slice(messages.length - limit);
}

export const conciergeChat = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { messages: ConciergeMessage[]; sessionId: string }) => data,
  )
  .handler(async ({ data }): Promise<ConciergeResponse> => {
    const cfg: ConciergeConfig = await loadConciergeConfig();
    if (!cfg.enabled) {
      return {
        reply:
          "Our concierge is being set up. Please use the Book Your Stay button or email hello@baiapalawan.com and our team will be glad to help.",
        unavailable: true,
      };
    }

    const history = trimHistory(data.messages);
    const lastGuest = [...history].reverse().find((m) => m.role === "guest");
    const question = lastGuest?.content ?? "";

    // Retrieve only relevant knowledge chunks (cheap, no embedding model).
    const { chunks } = retrieveRelevant(question, cfg.customKnowledge);
    const knowledgeBlock = chunksToText(chunks);
    const system = buildSystemPrompt(cfg, knowledgeBlock);

    // Resolve model for the chosen provider.
    let effective = cfg;
    if (cfg.provider === "ollama") {
      const model = await resolveOllamaModel(cfg.ollamaBaseUrl, cfg.ollamaModel);
      if (!model) {
        return {
          reply:
            "Our local concierge model isn't available right now. Please email hello@baiapalawan.com or use the Book Your Stay button and our team will assist you.",
          unavailable: true,
        };
      }
      effective = { ...cfg, ollamaModel: model };
    } else if (!cfg.openrouterApiKey) {
      return {
        reply:
          "Our concierge is almost ready — the owner still needs to add an OpenRouter key in the admin settings. Meanwhile, email hello@baiapalawan.com and we'll help right away.",
        unavailable: true,
      };
    }

    await logConciergeTurn(data.sessionId, "guest", question);

    try {
      const reply = await runModel(effective, system, history);
      await logConciergeTurn(data.sessionId, "agent", reply);
      return { reply };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fallback that still respects the no-price rule and routes to booking.
      return {
        reply:
          "I'm having a little trouble reaching my brain at the moment. For the quickest help, use the Book Your Stay button or email hello@baiapalawan.com — our team will confirm everything personally. (" +
          msg.slice(0, 120) +
          ")",
        unavailable: true,
      };
    }
  });
