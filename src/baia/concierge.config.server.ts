/**
 * Server-only config access for the concierge.
 *
 * SECURITY: the concierge config (which may contain the owner's OpenRouter
 * API key) is stored in a SERVER-ONLY Supabase table `concierge_config`.
 * It is read with the service-role client (`supabaseAdmin`) and never sent to
 * the browser. `site_state` is public-readable, so we deliberately do NOT put
 * the key there.
 */
import type { ConciergeConfig } from "./concierge.types";

const DEFAULT_CONFIG: ConciergeConfig = {
  enabled: false,
  provider: "ollama",
  openrouterApiKey: "",
  openrouterModel: "openai/gpt-4o-mini",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "",
  persona:
    "You are BAIA's friendly AI concierge for BAIA Beachfront Boutique Lodge, a barefoot-luxury retreat in San Vicente, Palawan. " +
    "Speak in a warm, calm, elegant tone that matches a high-end island resort. " +
    "Help guests with rooms, experiences, the area, bookings, and FAQs using ONLY the knowledge provided.",
  customKnowledge: "",
};

interface StoredConfigRow {
  data: Partial<ConciergeConfig>;
}

/** Load merged config from Supabase (server-side only). */
export async function loadConciergeConfig(): Promise<ConciergeConfig> {
  try {
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { data, error } = await supabaseAdmin
      .from("concierge_config")
      .select("data")
      .eq("key", "default")
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_CONFIG };
    const row = data as unknown as StoredConfigRow;
    return { ...DEFAULT_CONFIG, ...(row.data ?? {}) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Persist config (server-side, service role). Never call from client bundle. */
export async function saveConciergeConfig(
  cfg: ConciergeConfig,
): Promise<void> {
  const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
  const { error } = await supabaseAdmin
    .from("concierge_config")
    .upsert(
      { key: "default", data: cfg as unknown as Record<string, unknown>, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(`Failed to save concierge config: ${error.message}`);
}
