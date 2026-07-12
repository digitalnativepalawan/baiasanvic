/**
 * Admin-facing server functions for the concierge. These run server-side so
 * the OpenRouter key is never exposed to the browser bundle. The admin panel
 * calls these to load config, save config, and fetch the model dropdowns.
 */
import { createServerFn } from "@tanstack/react-start";
import type { ConciergeConfig, ModelCatalog } from "./concierge.types";
import { loadConciergeConfig, saveConciergeConfig } from "./concierge.config.server";
import { listOllamaModels } from "./concierge.discovery";

export const getConciergeConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<ConciergeConfig> => {
    return loadConciergeConfig();
  },
);

export const saveConciergeSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { config: ConciergeConfig }) => data)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await saveConciergeConfig(data.config);
    return { ok: true };
  });

// Returns available models for the admin dropdowns (no key required to list).
export const getConciergeModels = createServerFn({ method: "GET" }).handler(
  async (): Promise<ModelCatalog> => {
    let ollama: string[] = [];
    try {
      ollama = await listOllamaModels("http://localhost:11434");
    } catch {
      ollama = [];
    }

    let openrouter: string[] = [];
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: { id: string; pricing?: { prompt?: string } }[];
        };
        openrouter = (json.data ?? [])
          .map((m) => m.id)
          // Flag free models with a prefix so the dropdown can highlight them.
          .sort((a, b) => {
            const af = a.includes(":free") ? 0 : 1;
            const bf = b.includes(":free") ? 0 : 1;
            return af - bf;
          });
      }
    } catch {
      openrouter = [];
    }

    return { openrouter, ollama };
  },
);
