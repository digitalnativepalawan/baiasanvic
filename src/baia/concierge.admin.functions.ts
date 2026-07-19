/**
 * Admin-facing server functions for the concierge. These run server-side so
 * the OpenRouter key is never exposed to the browser bundle. The admin panel
 * calls these to load config, save config, and list OpenRouter models.
 *
 * Ollama model discovery is intentionally NOT server-side: the server runs in
 * a Cloudflare Worker and cannot reach the admin's localhost. The admin panel
 * fetches Ollama's /api/tags directly from the browser via
 * `listOllamaModelsBrowser` in concierge.discovery.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import type { ConciergeConfig } from "./concierge.types";
import { loadConciergeConfig, saveConciergeConfig } from "./concierge.config.server";

export const getConciergeConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConciergeConfig> => {
    return loadConciergeConfig();
  },
);

export interface ConciergeStatus {
  /** ONYX_BASE_URL + ONYX_API_KEY are both set in this environment. */
  onyxConfigured: boolean;
  /**
   * A live reachability probe to Onyx succeeded just now (same call shape a
   * real guest turn depends on). Only meaningful when onyxConfigured is true.
   */
  onyxReachable: boolean;
  /** Which brain is actually serving guest turns right now. */
  activeProvider: "onyx" | "openrouter" | "ollama" | "unavailable";
  /** cfg.provider === "openrouter" and an API key is saved. */
  openrouterReady: boolean;
  /** cfg.provider === "ollama" and a model name is saved. */
  ollamaConfigured: boolean;
}

/**
 * Live "who is actually answering guests" status for the admin panel.
 *
 * Mirrors the exact precedence used in concierge.server.ts's conciergeChat:
 * Onyx is preferred only when it's configured AND a live reachability probe
 * to it succeeds right now (not just when the env vars happen to be set —
 * a stale Cloudflare tunnel returning a 403 is treated as unreachable, same
 * as guests would experience it). Otherwise the core (OpenRouter/Ollama) is
 * used if the concierge is enabled and the provider is ready; otherwise the
 * concierge is not currently answering guests at all.
 *
 * Never returns any secret value — only booleans/enums.
 */
export const getConciergeStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConciergeStatus> => {
    const cfg = await loadConciergeConfig();
    const onyxConfigured = !!(process.env.ONYX_BASE_URL && process.env.ONYX_API_KEY);
    const openrouterReady = cfg.provider === "openrouter" && !!cfg.openrouterApiKey;
    const ollamaConfigured = cfg.provider === "ollama" && !!cfg.ollamaModel;

    let onyxReachable = false;
    if (onyxConfigured) {
      const { probeOnyxReachable } = await import("./onyx/client.server");
      onyxReachable = await probeOnyxReachable();
    }

    let activeProvider: ConciergeStatus["activeProvider"] = "unavailable";
    if (onyxConfigured && onyxReachable) {
      activeProvider = "onyx";
    } else if (cfg.enabled && openrouterReady) {
      activeProvider = "openrouter";
    } else if (cfg.enabled && ollamaConfigured) {
      activeProvider = "ollama";
    }

    return { onyxConfigured, onyxReachable, activeProvider, openrouterReady, ollamaConfigured };
  },
);

export const saveConciergeSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { config: ConciergeConfig }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean; onyxSynced: boolean; onyxError?: string }> => {
    // 1. Always save to Supabase first.
    await saveConciergeConfig(data.config);

    // 2. If Onyx is configured (env vars present), also push the updated
    // system prompt to the live Onyx persona so admin changes take effect
    // immediately. The persona id comes from ONYX_RESORT_PERSONA_ID (default 1).
    const onyxBaseUrl = process.env.ONYX_BASE_URL;
    const onyxApiKey = process.env.ONYX_API_KEY;
    const onyxPersonaId = Number(process.env.ONYX_RESORT_PERSONA_ID ?? "1");

    if (onyxBaseUrl && onyxApiKey) {
      const { buildOnyxSystemPrompt, syncPersonaToOnyx } =
        await import("./onyx/persona-sync.server");
      const systemPrompt = buildOnyxSystemPrompt(data.config);
      const result = await syncPersonaToOnyx(onyxBaseUrl, onyxApiKey, onyxPersonaId, systemPrompt);
      if (!result.ok) {
        return { ok: true, onyxSynced: false, onyxError: result.error };
      }
    }
    return { ok: true, onyxSynced: true };
  });

/**
 * Fetch the live list of OpenRouter model ids. Runs server-side to sidestep
 * CORS and keep the endpoint under our control. Free models (":free") are
 * sorted to the top so the admin can spot them first.
 */
export const getOpenRouterModels = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ models: string[]; error?: string }> => {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        return { models: [], error: `OpenRouter ${res.status}` };
      }
      const json = (await res.json()) as {
        data?: { id: string }[];
      };
      const models = (json.data ?? [])
        .map((m) => m.id)
        .filter(Boolean)
        .sort((a, b) => {
          const af = a.includes(":free") ? 0 : 1;
          const bf = b.includes(":free") ? 0 : 1;
          if (af !== bf) return af - bf;
          return a.localeCompare(b);
        });
      return { models };
    } catch (err) {
      return {
        models: [],
        error: err instanceof Error ? err.message : "Failed to fetch OpenRouter models",
      };
    }
  },
);
