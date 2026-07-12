/**
 * Ollama model auto-discovery.
 *
 * Two flavors:
 *  - Server-side (`listOllamaModels`, `resolveOllamaModel`): used by the
 *    chat server function in case the owner runs Ollama on the same host
 *    as the site. In hosted/Worker environments this will almost always
 *    return an empty list — that's expected.
 *  - Browser-side (`listOllamaModelsBrowser`): used by the admin settings
 *    panel to reach Ollama running on the admin's own laptop. Classifies
 *    failure modes so the UI can guide the admin (CORS vs down vs empty).
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

// ---------------------------------------------------------------------------
// Browser-side discovery for the admin panel
// ---------------------------------------------------------------------------

export type OllamaBrowserResult =
  | { status: "ok"; models: string[] }
  | { status: "empty" }
  | { status: "cors_or_down"; message: string }
  | { status: "mixed_content"; message: string }
  | { status: "http_error"; code: number };

/**
 * Fetch Ollama's installed models from the ADMIN'S BROWSER (not the server).
 * Browsers can't distinguish "server is down" from "CORS blocked" — both look
 * like a `TypeError: Failed to fetch`. We surface a message covering both.
 *
 * If the page is https:// and the baseUrl is http://, the browser blocks the
 * request as mixed content before it ever hits the network — we detect that
 * up front and return a targeted message.
 */
export async function listOllamaModelsBrowser(
  baseUrl: string,
): Promise<OllamaBrowserResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;

  // Mixed content check: an https:// admin page can't call http://localhost.
  try {
    if (
      typeof window !== "undefined" &&
      window.location.protocol === "https:" &&
      url.startsWith("http://")
    ) {
      return {
        status: "mixed_content",
        message:
          "This admin page is served over HTTPS, so the browser blocks calls to http://localhost. Open the admin on http:// (or run Ollama behind an HTTPS reverse proxy) to auto-detect models.",
      };
    }
  } catch {
    /* ignore */
  }

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { status: "http_error", code: res.status };
    const json = (await res.json()) as { models?: { name?: string }[] };
    const models = (json.models ?? [])
      .map((m) => m.name ?? "")
      .filter(Boolean);
    if (models.length === 0) return { status: "empty" };
    return { status: "ok", models };
  } catch {
    return {
      status: "cors_or_down",
      message:
        "Can't reach Ollama. Either it isn't running, or CORS is blocking the browser. If it's running, restart it with OLLAMA_ORIGINS=* (macOS/Linux: `OLLAMA_ORIGINS=* ollama serve`; Windows: set the OLLAMA_ORIGINS env var to * and restart Ollama).",
    };
  }
}
