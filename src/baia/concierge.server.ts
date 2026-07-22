/**
 * Server function: one turn of the concierge conversation.
 *
 * All safety, intent, knowledge-retrieval, lead-extraction, and reply
 * sanitization logic lives directly in this module and its sibling
 * concierge.* files (concierge.guardrails.ts, concierge.knowledge.ts,
 * concierge.leads.ts, concierge.retrieve.ts, concierge.answer.ts). There is
 * no separate "src/resort-agent" orchestrator package in this repo — an
 * earlier refactor plan referenced one, but it was never created; this file
 * is the single source of truth for a guest turn.
 *
 * DESIGN PRINCIPLE: the concierge must work for guests with ZERO external
 * LLM providers configured. Onyx and OpenRouter/Ollama are optional quality
 * enhancers for open-ended questions — they never decide whether the
 * concierge works at all. The guest-facing flow is, in order:
 *
 *   guest message
 *   -> detect qualified lead and save it          (concierge.leads.ts)
 *   -> detect price question and refuse it        (concierge.guardrails.ts)
 *   -> answer known BAIA topics deterministically  (concierge.answer.ts)
 *   -> use Onyx/OpenRouter only for unknown questions (optional enhancers)
 *   -> otherwise return the BAIA contact fallback
 *
 * The absolute pricing rule is enforced pre-model (detectIntent), in the
 * deterministic answerer (stripMonetary + scanForMoney), and post-model
 * (sanitizeReply) — three independent layers, none of which depend on a
 * provider being configured.
 */
import { createServerFn } from "@tanstack/react-start";
import type { ConciergeConfig, ConciergeMessage, ConciergeResponse } from "./concierge.types";
import { loadConciergeConfig } from "./concierge.config.server";
import { buildSystemPrompt } from "./concierge.prompt";
import { retrieveRelevant, chunksToText } from "./concierge.retrieve";
import { buildMenuAnswer, isNoKnowledgeFallback, isMenuQuestion } from "./concierge.knowledge";
import { answerKnownTopic } from "./concierge.answer";
import { loadDbKnowledgeChunks } from "./concierge.knowledge.server";

import { resolveOllamaModel } from "./concierge.discovery";
import { logConciergeTurn } from "./concierge.log.server";
import { runModel } from "./concierge.llm";
import { detectIntent, sanitizeReply, APPROVED_RATE_RESPONSE } from "./concierge.guardrails";
import { extractBookingInquiry, buildLeadConfirmationReply } from "./concierge.leads";
import { handleCreateGuestLead, deriveGuestLeadIdempotencyKey } from "./ops/guest-lead.server";

const MAX_HISTORY_TURNS = 10;
const BAIA_RESORT_ID = "baia-san-vicente";

// Used only when nothing else could answer: no lead was detected, the
// question wasn't a price question, the deterministic knowledge base had no
// confident match, and no LLM enhancer (Onyx/OpenRouter/Ollama) was
// configured, reachable, or successful. Guests always land on a real
// contact path, never a dead end.
const CONTACT_FALLBACK_REPLY =
  "Thanks for your message! For anything I can't answer here, please email hello@baiapalawan.com " +
  "or use the Book Your Stay button and our team will follow up shortly.";

function trimHistory(messages: ConciergeMessage[]): ConciergeMessage[] {
  const limit = MAX_HISTORY_TURNS * 2;
  if (messages.length <= limit) return messages;
  return messages.slice(messages.length - limit);
}

export const conciergeChat = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ConciergeMessage[]; sessionId: string }) => data)
  .handler(async ({ data }): Promise<ConciergeResponse> => {
    // Config load is fail-safe (see concierge.config.server.ts) and is only
    // used here for optional LLM-enhancer settings (provider, keys, persona,
    // custom knowledge) and admin on/off. It is NOT required for the
    // deterministic core below.
    const cfg: ConciergeConfig = await loadConciergeConfig();
    // Onyx is on standby unless explicitly enabled via ONYX_ENABLED=true.
    // Env vars can remain set; the block is simply skipped when the flag
    // is off, so low-season traffic goes straight to the deterministic
    // knowledge layer and (if needed) OpenRouter enhancer.
    const onyxEnabled = process.env.ONYX_ENABLED === "true";
    const onyxConfigured =
      onyxEnabled && !!(process.env.ONYX_BASE_URL && process.env.ONYX_API_KEY);

    const history = trimHistory(data.messages);
    const lastGuest = [...history].reverse().find((m) => m.role === "guest");
    const question = lastGuest?.content ?? "";

    // ---------------------------------------------------------------------
    // 1. Qualified-lead detection & capture — deterministic, no LLM, always
    //    available regardless of provider configuration.
    // ---------------------------------------------------------------------
    const bookingInquiry = extractBookingInquiry(question);
    if (bookingInquiry) {
      try {
        const idemKey = deriveGuestLeadIdempotencyKey(data.sessionId, question);
        const evidence = await handleCreateGuestLead({
          resort_id: BAIA_RESORT_ID,
          idempotency_key: idemKey,
          channel: "website",
          guest: {
            name: bookingInquiry.name ?? undefined,
            email: bookingInquiry.email,
            phone: bookingInquiry.phone ?? undefined,
          },
          stay: {
            check_in: bookingInquiry.checkIn ?? undefined,
            check_out: bookingInquiry.checkOut ?? undefined,
            adults: bookingInquiry.adults ?? undefined,
          },
        });
        const reply = buildLeadConfirmationReply(!evidence.created);
        await logConciergeTurn(data.sessionId, "guest", question);
        await logConciergeTurn(data.sessionId, "agent", reply);
        return {
          reply,
          intent: "booking_inquiry",
          approvalRequired: false,
          databaseWriteDeferred: false,
          sanitized: false,
          brain: "deterministic",
          actions: [
            {
              name: "create_guest_lead",
              status: "success",
              evidenceJson: JSON.stringify(evidence),
            },
          ],
        };
      } catch (err) {
        // Never let lead-capture failure break the guest's turn — fall
        // through to the normal answer flow below.
        console.error("Guest lead capture failed:", err);
      }
    }

    // ---------------------------------------------------------------------
    // 2. Price/rate questions — deterministic, never sent to a model.
    // ---------------------------------------------------------------------
    const intent = detectIntent(question);
    if (intent.isRateQuestion) {
      await logConciergeTurn(data.sessionId, "guest", question);
      await logConciergeTurn(data.sessionId, "agent", APPROVED_RATE_RESPONSE);
      return {
        reply: APPROVED_RATE_RESPONSE,
        intent: intent.intent,
        approvalRequired: intent.approvalRequired,
        databaseWriteDeferred: intent.databaseWriteDeferred,
        sanitized: true,
        brain: "deterministic",
      };
    }

    // ---------------------------------------------------------------------
    // 3. Known BAIA topics — answered directly from approved static
    //    knowledge (location, rooms, dining/menu, transport, experiences,
    //    booking instructions, stay details, families, nearby town). No
    //    model call, no provider requirement. This is what keeps the
    //    concierge working end to end even with an invalid/missing
    //    OpenRouter key and no Onyx connection.
    // ---------------------------------------------------------------------
    const deterministic = answerKnownTopic(question);
    if (deterministic) {
      await logConciergeTurn(data.sessionId, "guest", question);
      await logConciergeTurn(data.sessionId, "agent", deterministic.reply);
      return {
        reply: deterministic.reply,
        intent: intent.intent,
        approvalRequired: false,
        databaseWriteDeferred: false,
        sanitized: false,
        brain: "deterministic",
      };
    }

    // ---------------------------------------------------------------------
        // 4. Unknown / open-ended question — try optional LLM enhancers.
        //    Onyx first (if configured), then OpenRouter/Ollama. Either one
        //    failing, being unreachable, or not configured simply falls through
        //    to the next option, and ultimately to the contact fallback. A
        //    guest question NEVER hard-fails just because a provider is broken.
        // ---------------------------------------------------------------------
        if (onyxConfigured) {
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
            const onyxReply = (onyxRes.reply ?? "").trim();
            if (!onyxRes.error && onyxReply.length > 0) {
              await logConciergeTurn(data.sessionId, "guest", question);
              await logConciergeTurn(data.sessionId, "agent", onyxReply);
              const finalReply =
                onyxRes.intent !== "booking_inquiry" &&
                isMenuQuestion(question) &&
                isNoKnowledgeFallback(onyxReply)
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
            // Log Onyx error and fall through to core enhancer
            if (onyxRes.error) {
              await logConciergeTurn(
                data.sessionId,
                "agent",
                "",
                { source: "onyx", onyxError: onyxRes.error }
              );
            }
            console.warn("Onyx returned no usable reply, trying core enhancer:", onyxRes.error);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            await logConciergeTurn(
              data.sessionId,
              "agent",
              "",
              { source: "onyx", onyxError: errMsg }
            );
            console.error("Onyx enhancer failed, trying core enhancer:", err);
          }
        }

    // ---------------- Core enhancer (OpenRouter / Ollama direct) ----------
    // Only reached for a question the deterministic layer wasn't confident
    // about, and only used if the concierge is enabled AND a provider is
    // actually usable. Any failure here (disabled, unconfigured, invalid
    // key, network error) falls through to the contact fallback below —
    // guests never see an error, and the deterministic core above already
    // covers every approved BAIA topic regardless of what happens here.
    let effective: ConciergeConfig | null = null;
    if (cfg.enabled && cfg.provider === "ollama" && cfg.ollamaModel?.trim()) {
      effective = cfg;
    } else if (cfg.enabled && cfg.provider === "ollama") {
      const model = await resolveOllamaModel(cfg.ollamaBaseUrl, cfg.ollamaModel).catch(() => null);
      if (model) effective = { ...cfg, ollamaModel: model };
    } else if (
      cfg.enabled &&
      cfg.provider === "openrouter" &&
      cfg.openrouterApiKey?.trim().length >= 20
    ) {
      effective = cfg;
    }

    if (effective) {
      try {
        const { chunks } = retrieveRelevant(question, cfg.customKnowledge);
        const knowledgeBlock = chunksToText(chunks);
        const system = buildSystemPrompt(effective, knowledgeBlock);
        const raw = await runModel(effective, system, history);

        // Menu fallback: only substitute the in-repo menu knowledge when the
        // GUEST'S QUESTION was actually about food/dining/menu AND the
        // model's reply was a no-knowledge dead-end.
        const replyForMenuCheck =
          isMenuQuestion(question) && isNoKnowledgeFallback(raw) ? buildMenuAnswer() : raw;

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
      } catch (err) {
        console.error("Core enhancer failed, using contact fallback:", err);
      }
    }

    // ---------------------------------------------------------------------
    // 5. Nothing could answer — always give the guest a real path forward.
    // ---------------------------------------------------------------------
    await logConciergeTurn(data.sessionId, "guest", question);
    await logConciergeTurn(data.sessionId, "agent", CONTACT_FALLBACK_REPLY);
    return {
      reply: CONTACT_FALLBACK_REPLY,
      intent: intent.intent,
      approvalRequired: false,
      databaseWriteDeferred: false,
      sanitized: false,
      brain: "fallback",
    };
  });
