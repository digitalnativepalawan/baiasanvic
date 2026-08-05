import { supabase } from "@/integrations/supabase/client";

export interface HermesConfig {
  server_url: string;
  provider: string;
  model: string;
  openrouter_api_key: string;
  ollama_base_url: string;
}

const DEFAULTS: HermesConfig = {
  server_url: "http://127.0.0.1:8100",
  provider: "openrouter",
  model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  openrouter_api_key: "",
  ollama_base_url: "http://localhost:11434",
};

export async function getHermesConfig(): Promise<HermesConfig> {
  try {
    const { data, error } = await supabase
      .from("tala_config")
      .select("value")
      .eq("key", "hermes")
      .single();
    if (error || !data) return DEFAULTS;
    return { ...DEFAULTS, ...(data.value as Partial<HermesConfig>) };
  } catch {
    return DEFAULTS;
  }
}

export async function saveHermesConfig(config: Partial<HermesConfig>): Promise<void> {
  const current = await getHermesConfig();
  const merged = { ...current, ...config };
  const { error } = await supabase
    .from("tala_config")
    .upsert({ key: "hermes", value: merged, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}
