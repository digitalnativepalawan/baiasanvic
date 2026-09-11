/**
 * Server function: one turn of the guest conversation.
 *
 * The brain is now TALA (src/baia/tala/agent/tala.loop.ts) — one agent with
 * real tools, running the same battle-tested layer order this file used to
 * implement inline:
 *
 *   guest message
 *   -> detect qualified lead and save it          (concierge.leads.ts)
 *   -> detect price question and refuse it        (concierge.guardrails.ts)
 *   -> answer known BAIA topics deterministically (concierge.answer.ts)
 *   -> TALA agentic loop: model + tools           (tala/agent/tala.loop.ts)
 *   -> otherwise return the BAIA contact fallback
 *
 * This file remains the public server-function entry the guest widget calls;
 * it maps TALA's GuestTurnResult onto the historical ConciergeResponse shape
 * so the widget, admin status panel, and tests keep working unchanged.
 *
 * DESIGN PRINCIPLE: TALA must work for guests with ZERO external LLM
 * providers configured — the deterministic layers cover every approved BAIA
 * topic on their own, and the agentic loop is a quality enhancer that never
 * decides whether the concierge works at all.
 */
import { createServerFn } from "@tanstack/react-start";
import type { ConciergeMessage, ConciergeResponse } from "./concierge.types";
import { runGuestTurn } from "./tala/agent/tala.loop";

export const conciergeChat = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ConciergeMessage[]; sessionId: string }) => data)
  .handler(async ({ data }): Promise<ConciergeResponse> => {
    const turn = await runGuestTurn({
      messages: data.messages,
      sessionId: data.sessionId,
    });

    return {
      reply: turn.reply,
      unavailable: false,
      intent: turn.intent,
      approvalRequired: turn.approvalRequired,
      databaseWriteDeferred: turn.databaseWriteDeferred,
      sanitized: turn.sanitized,
      actions: turn.actions.map((a) => ({
        name: a.name,
        status: a.status,
        evidenceJson: a.evidenceJson,
      })),
      brain: turn.brain,
    };
  });
