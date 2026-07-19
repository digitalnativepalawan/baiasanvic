/**
 * Server function: one turn of the concierge conversation.
 *
 * Refactored to route through the reusable Resort Agent core
 * (src/resort-agent/core/orchestrator.ts) so all safety, intent, qualification,
 * approval, and persistence logic lives in one provider-independent place.
 * The existing OpenRouter/Ollama provider system is preserved via the
 * concierge-model adapter; the widget and booking form are untouched.
 *
 * Flow:
 *   ConciergeWidget -> conciergeChat -> runResortAgent (generic core)
 *     -> intent -> knowledge -> extraction -> action/approval -> safe reply
 *     -> temporary persistence (memory adapter until Supabase confirmed)
 *
 * The absolute pricing rule is enforced in the core (3 layers) and the
 * response sanitizer.
 */
import { createServerFn } from "@tanstack/react-start";
import type { ConciergeConfig, ConciergeMessage, ConciergeResponse } from "./concierge.types";
import { loadConciergeConfig } from "./concierge.config.server";
import { buildSystemPrompt } from "./concierge.prompt";
import { retrieveRelevant, chunksToText } from "./concierge.retrieve";
import { buildMenuAnswer, isNoKnowledgeFallback } from "./concierge.knowledge";
import { resolveOllamaModel } from "./concierge.discovery";
import { logConciergeTurn } from "./concierge.log.server";
import { runModel } from "./concierge.llm";
import { detectIntent, sanitizeReply, APPROVED_RATE_RESPONSE } from "./concierge.guardrails";

const MAX_HISTORY_TURNS = 10;
const BAIA_RESORT_ID = "baia-san-vicente";

function trimHistory(messages: ConciergeMessage[]): ConciergeMessage[] {
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
    // Onyx brain is enabled whenever its environment is configured, independent
    // of the Supabase concierge_config.enabled flag (which is false in local/dev
    // where no service-role key is present). This lets the existing Onyx persona
    // drive the concierge locally without a Supabase config row.
    const onyxConfigured = !!(process.env.ONYX_BASE_URL && process.env.ONYX_API_KEY);
    if (!cfg.enabled && !onyxConfigured) {
      return {
        reply:
          "Our concierge is being set up. Please use the Book Your Stay button or email hello@baiapalawan.com and our team will be glad to help.",
        unavailable: true,
      };
    }

    const history = trimHistory(data.messages);
    const lastGuest = [...history].reverse().find((m) => m.role === "guest");
    const question = lastGuest?.content ?? "";

    // --- Onyx brain (preferred when configured) --------------------------------
    // When ONYX_BASE_URL + ONYX_API_KEY are set, route the guest turn through the
    // Onyx Resort Agent runtime. The Onyx create_guest_lead tool calls BAIA's
    // /api/ops/guest-lead endpoint; Onyx never touches Supabase directly.
    // If Onyx is not configured, fall back to the existing core so the site keeps
    // working exactly as before.
    if (process.env.ONYX_BASE_URL && process.env.ONYX_API_KEY) {
      try {
        const { createOnyxResortAgentClient } = await import("./onyx/client.server");
        const onyx = createOnyxResortAgentClient();
        const onyxRes = await onyx.sendGuestEvent({
          resortId: BAIA_RESORT_ID,
          conversationId: data.sessionId,
          messageId: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          channel: "website",
          message: question,
          onyxSessionId: (data as { onyxSessionId?: string }).onyxSessionId,
        });
        // Fall through to the core fallback if Onyx returned an error result,
        // an empty reply, or was otherwise not able to answer. This keeps the
        // guest experience seamless when the Onyx tunnel is unreachable /
        // returns 401/403/404/429/5xx / malformed output.
        const onyxReply = (onyxRes.reply ?? "").trim();
        if (!onyxRes.error && onyxReply.length > 0) {
          await logConciergeTurn(data.sessionId, "guest", question);
          await logConciergeTurn(data.sessionId, "agent", onyxReply);
          const finalReply =
            onyxRes.intent !== "booking_inquiry" && isNoKnowledgeFallback(onyxReply)
              ? buildMenuAnswer()
              : onyxReply;
          return {
            reply: finalReply,
            intent: onyxRes.intent,
            approvalRequired: onyxRes.approvalRequired,
            onyxSessionId: onyxRes.onyxSessionId,
            runId: onyxRes.runId,
            actions: onyxRes.actions.map((a) => ({
              name: a.name,
              status: a.status,
              evidenceJson: a.evidence ? JSON.stringify(a.evidence) : undefined,
            })),
            brain: "onyx",
          };
        }
        console.warn("Onyx returned no usable reply, falling back to core:", onyxRes.error);
      } catch (err) {
        // Onyx unreachable — fall through to the existing core (no guest-facing break).
        console.error("Onyx brain failed, falling back to core:", err);
      }
    }

    // ---------------- Core fallback (OpenRouter / Ollama direct) --------------
    // Used when Onyx is not configured or unreachable. Preserves the no-price
    // rule via detectIntent + sanitizeReply, the menu fallback via
    // buildMenuAnswer, and guest-facing safety wording.
    let effective = cfg;
    if (cfg.provider === "ollama") {
      const model = cfg.ollamaModel?.trim()
        ? cfg.ollamaModel.trim()
        : await resolveOllamaModel(cfg.ollamaBaseUrl, cfg.ollamaModel);
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

    const intent = detectIntent(question);

    // Rate/pricing questions: never call the model — return the approved reply.
    if (intent.isRateQuestion) {
      await logConciergeTurn(data.sessionId, "guest", question);
      await logConciergeTurn(data.sessionId, "agent", APPROVED_RATE_RESPONSE);
      return {
        reply: APPROVED_RATE_RESPONSE,
        intent: intent.intent,
        approvalRequired: intent.approvalRequired,
        databaseWriteDeferred: intent.databaseWriteDeferred,
        sanitized: true,
        brain: "core",
      };
    }

    const { chunks } = retrieveRelevant(question, cfg.customKnowledge);
    const knowledgeBlock = chunksToText(chunks);
    const system = buildSystemPrompt(effective, knowledgeBlock);

    let raw: string;
    try {
      raw = await runModel(effective, system, history);
    } catch (err) {
      console.error("Core concierge model failed:", err);
      return {
        reply:
          "Our concierge is having trouble right now. Please email hello@baiapalawan.com or use the Book Your Stay button and our team will help you directly.",
        unavailable: true,
      };
    }

    // Menu fallback: if the model returns a no-knowledge dead-end for a menu
    // question, answer from the BAIA in-repo menu knowledge (no prices).
    const replyForMenuCheck = isNoKnowledgeFallback(raw) ? buildMenuAnswer() : raw;

    const guarded = sanitizeReply(replyForMenuCheck, intent.intent);

    await logConciergeTurn(data.sessionId, "guest", question);
    await logConciergeTurn(data.sessionId, "agent", guarded.reply);

    return {
      reply: guarded.reply,
      intent: guarded.intent,
      approvalRequired: guarded.approvalRequired,
      databaseWriteDeferred: guarded.databaseWriteDeferred,
      sanitized: guarded.sanitized,
      brain: "core",
    };
  });
