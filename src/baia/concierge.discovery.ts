/**
 * Ollama model auto-discovery. Lists models installed on the device running
 * the server (GET /api/tags) and returns their names — no hardcoded list, so
 * the admin dropdown always reflects what's actually available.
 */
export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { models?: { name?: string }[] };
    return (json.models ?? [])
      .map((m) => m.name ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Pick the best available Ollama model: prefer what's configured, else the
 * largest capable model installed, else the first available.
 */
export async function resolveOllamaModel(
  baseUrl: string,
  configured: string,
): Promise<string | null> {
  const models = await listOllamaModels(baseUrl);
  if (models.length === 0) return null;
  if (configured && models.includes(configured)) return configured;
  // Prefer a 9B+ model for quality, else any.
  const big = models.find((m) => /\b(9b|13b|14b|32b|70b|32|70)\b/i.test(m));
  if (big) return big;
  return models[0];
}
