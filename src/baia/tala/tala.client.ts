/**
 * Client-side helpers for TALA Agent.
 */
import type { TalaChatResponse, TalaStatus } from "./tala.types";

const TALA_API_URL = import.meta.env.VITE_TALA_API_URL || "http://localhost:8100";

export async function talaChat(
  message: string,
  sessionId: string
): Promise<TalaChatResponse> {
  const res = await fetch(`${TALA_API_URL}/api/tala/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  if (!res.ok) {
    throw new Error(`TALA API ${res.status}`);
  }

  return res.json();
}

export async function talaStatus(): Promise<TalaStatus> {
  const res = await fetch(`${TALA_API_URL}/api/tala/status`);
  if (!res.ok) {
    throw new Error(`TALA status ${res.status}`);
  }
  return res.json();
}

export async function talaVoice(
  audioBase64: string,
  sessionId: string,
  voice?: string
) {
  const res = await fetch(`${TALA_API_URL}/api/tala/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_base64: audioBase64,
      session_id: sessionId,
      voice,
    }),
  });

  if (!res.ok) {
    throw new Error(`TALA voice ${res.status}`);
  }

  return res.json();
}
