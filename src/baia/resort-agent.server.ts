/**
 * BAIA-specific Resort Agent integration (server-side).
 *
 * Thin bridge: the existing ConciergeWidget still calls conciergeChat, which now
 * routes each guest message through the reusable autonomous runtime via the
 * compatibility wrapper. The reusable core (src/resort-agent/runtime) holds all
 * goal/event/plan/approval/scheduling logic; this file only adapts BAIA's
 * server-fn envelope and the stable resort id 'baia-san-vicente'.
 *
 * Server-only. The browser never imports the runtime repositories.
 */
import { createServerFn } from "@tanstack/react-start";
import { loadConciergeConfig } from "./concierge.config.server";
import { runResortAgentCompat } from "../resort-agent/runtime/bridge";

const BAIA_RESORT_ID = "baia-san-vicente";

export const runResortAgentChat = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      messages: { role: "guest" | "agent"; content: string }[];
      sessionId: string;
      messageId: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<{
    reply: string;
    intent: string;
    approvalRequired: boolean;
    databaseWriteDeferred: boolean;
  }> => {
    const cfg = await loadConciergeConfig();
    if (!cfg.enabled) {
      return {
        reply:
          "Our concierge is being set up. Please use the Book Your Stay button or email hello@baiapalawan.com and our team will be glad to help.",
        intent: "general",
        approvalRequired: false,
        databaseWriteDeferred: true,
      };
    }

    const lastGuest = [...data.messages].reverse().find((m) => m.role === "guest");
    const question = lastGuest?.content ?? "";

    const result = await runResortAgentCompat({
      resortId: BAIA_RESORT_ID,
      conversationId: data.sessionId,
      messageId: data.messageId,
      message: question,
      guest: {},
    });

    return {
      reply: result.reply,
      intent: result.intent,
      approvalRequired: result.approvalRequired,
      databaseWriteDeferred: result.databaseWriteDeferred,
    };
  });
