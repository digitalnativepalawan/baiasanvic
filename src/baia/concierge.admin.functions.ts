/**
 * Admin-facing server functions for the concierge. These run server-side so
 * the OpenRouter key is never exposed to the browser bundle. The admin panel
 * calls these to load config, save config, and list OpenRouter models.
 *
 * Ollama model discovery is intentionally NOT server-side: the server is
 * hosted server-side and cannot reach the admin's localhost. The admin panel
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
  /** Which brain is actually serving guest turns right now. */
  activeProvider: "openrouter" | "ollama" | "unavailable";
  /** cfg.provider === "openrouter" and an API key is saved. */
  openrouterReady: boolean;
  /** cfg.provider === "ollama" and a model name is saved. */
  ollamaConfigured: boolean;
}

/**
 * Live "who is actually answering guests" status for the admin panel.
 *
 * Mirrors the precedence used by TALA's guest turn: the agentic loop runs
 * when the concierge is enabled and the configured provider (OpenRouter or
 * Ollama) is ready; otherwise guests are served by the deterministic
 * knowledge layer and the contact fallback ("unavailable" here means no
 * agentic loop — the concierge itself still answers known topics).
 *
 * Never returns any secret value — only booleans/enums.
 */
export const getConciergeStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConciergeStatus> => {
    const cfg = await loadConciergeConfig();
    // Real OpenRouter keys are long ("sk-or-v1-..." plus 60+ hex chars). A short
    // placeholder/typo value (e.g. a handful of digits) will always fail
    // OpenRouter auth with a 401 — do not report the provider as "ready" for
    // guests when the saved key is obviously not a usable credential.
    const openrouterReady =
      cfg.provider === "openrouter" &&
      !!cfg.openrouterApiKey &&
      cfg.openrouterApiKey.trim().length >= 20;
    const ollamaConfigured = cfg.provider === "ollama" && !!cfg.ollamaModel;

    let activeProvider: ConciergeStatus["activeProvider"] = "unavailable";
    if (cfg.enabled && openrouterReady) {
      activeProvider = "openrouter";
    } else if (cfg.enabled && ollamaConfigured) {
      activeProvider = "ollama";
    }

    return { activeProvider, openrouterReady, ollamaConfigured };
  },
);

export const saveConciergeSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { config: ConciergeConfig }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    // Save to Supabase; TALA reads the config fresh on every turn, so admin
    // changes take effect immediately — no persona sync step needed.
    await saveConciergeConfig(data.config);
    return { ok: true };
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
