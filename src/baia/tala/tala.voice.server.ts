/**
 * Server function: send voice to TALA Agent.
 * Returns transcribed text, reply, and audio.
 */
import { createServerFn } from "@tanstack/react-start";

const TALA_API_URL = process.env.TALA_API_URL || "http://localhost:8100";

export const talaVoice = createServerFn({ method: "POST" })
  .validator(
    (data: { audioBase64: string; sessionId: string; voice?: string }) => data
  )
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`${TALA_API_URL}/api/tala/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: data.audioBase64,
          session_id: data.sessionId,
          voice: data.voice || "en-US-JennyNeural",
        }),
      });

      if (!res.ok) {
        throw new Error(`TALA voice API ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      console.error("TALA voice error:", err);
      return { error: "Voice service unavailable" };
    }
  });
