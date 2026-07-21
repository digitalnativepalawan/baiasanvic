/**
 * Health check endpoint for Onyx integration.
 * Returns whether Onyx is configured and reachable in the current environment.
 * Used by admin UI to show connection status.
 */
import { createServerFn } from "@tanstack/react-start";

export interface OnyxStatus {
  configured: boolean;
  reachable: boolean;
  personaName?: string;
  error?: string;
}

export const getOnyxStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<OnyxStatus> => {
    const baseUrl = process.env.ONYX_BASE_URL;
    const apiKey = process.env.ONYX_API_KEY;
    const personaId = process.env.ONYX_RESORT_PERSONA_ID ?? "1";

    // Not configured if either env var is missing
    if (!baseUrl || !apiKey) {
      return { configured: false, reachable: false };
    }

    // Try to reach the persona endpoint
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/persona/${personaId}`, {
        method: "GET",
        headers: {
          authorization: apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return {
          configured: true,
          reachable: false,
          error: `HTTP ${res.status}`,
        };
      }

      const data = (await res.json()) as { name?: string };
      return {
        configured: true,
        reachable: true,
        personaName: data.name,
      };
    } catch (err) {
      return {
        configured: true,
        reachable: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
);