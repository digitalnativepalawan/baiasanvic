/**
 * Server function: send a message to TALA Agent.
 * Falls back to the existing concierge if TALA is unreachable.
 */
import { createServerFn } from "@tanstack/react-start";
import type { TalaChatRequest, TalaChatResponse } from "./tala.types";

const TALA_API_URL = process.env.TALA_API_URL || "http://localhost:8100";

export const talaChat = createServerFn({ method: "POST" })
  .validator((data: TalaChatRequest) => data)
  .handler(async ({ data }): Promise<TalaChatResponse> => {
    try {
      const res = await fetch(`${TALA_API_URL}/api/tala/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: data.message,
          session_id: data.sessionId,
          context: data.context,
        }),
      });

      if (!res.ok) {
        throw new Error(`TALA API ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      console.error("TALA agent unreachable, falling back:", err);
      return {
        reply: "",
        brain: "fallback",
        actions: [],
      };
    }
  });
