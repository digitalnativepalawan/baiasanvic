## Problem

The AI Concierge settings panel has two broken flows:

1. **Ollama auto-detect never works** — `getConciergeModels` is a server function running in the Cloudflare Worker, so its `fetch("http://localhost:11434/api/tags")` hits the Worker's localhost, not the admin's laptop. The Ollama dropdown is therefore always empty.
2. **OpenRouter model list & chat wiring** — the model list fetch works today, but is bundled with the Ollama call in the same server function, and there's no clear split between "list models (browser-safe)" and "chat with key (server-only)". We'll tighten this so the panel + chat both reliably use the saved key.

## Changes

### 1. `src/baia/concierge.discovery.ts`
- Keep `listOllamaModels(baseUrl)` and `resolveOllamaModel` (still used server-side by `concierge.server.ts` in case the owner ever runs Ollama on the same machine as the site).
- Add a **browser-safe** helper `listOllamaModelsBrowser(baseUrl)` that:
  - `fetch`es `{baseUrl}/api/tags` from the browser.
  - Returns `{ status: "ok", models: string[] }` on success.
  - On failure, classifies:
    - `TypeError` (Failed to fetch) → `{ status: "cors_or_down" }` (browser can't tell them apart, so message covers both).
    - HTTP non-2xx → `{ status: "http_error", code }`.
    - Empty list → `{ status: "empty" }`.

### 2. `src/baia/concierge.admin.functions.ts`
- Split `getConciergeModels` into two:
  - `getOpenRouterModels` (server fn, GET) — fetches `https://openrouter.ai/api/v1/models` and returns the id list, free ones sorted first. Server-side to avoid CORS surprises.
  - Remove Ollama from server-side listing (was misleading — Worker localhost).
- Keep `getConciergeConfig` and `saveConciergeSettings` unchanged.

### 3. `src/baia/components/ConciergeSettings.tsx`
- On mount / Refresh:
  - If provider is `openrouter`, call `getOpenRouterModels()` server fn.
  - If provider is `ollama`, call `listOllamaModelsBrowser(cfg.ollamaBaseUrl)` **from the browser**, using the URL currently typed in the input (so Refresh reflects edits).
- Show provider-specific status under the Ollama section:
  - `ok` + models → list count, no warning.
  - `cors_or_down` → amber warning: *"Can't reach Ollama at `{url}`. Either Ollama isn't running, or CORS is blocking the browser. If Ollama is running, restart it with `OLLAMA_ORIGINS=* ollama serve` (macOS/Linux) or set the `OLLAMA_ORIGINS` env var to `*` on Windows."*
  - `empty` → *"Ollama is reachable but no models are installed. Run e.g. `ollama pull llama3.1`."*
  - `http_error` → show status code.
- Keep OpenRouter dropdown behavior (list live, `:free` flagged, current-value preserved).

### 4. OpenRouter chat wiring — verify only, no code change needed
`concierge.server.ts` → `runModel` → `callOpenRouter` in `concierge.llm.ts` already:
- Runs server-side (createServerFn handler).
- Reads `cfg.openrouterApiKey` from Supabase server-side config.
- Sends `Authorization: Bearer <key>` to `https://openrouter.ai/api/v1/chat/completions`.
- Never exposes the key to the browser (config is only returned to admin via `getConciergeConfig`, which is fine — admin edits it).

We'll confirm after wiring the model dropdown that a real chat turn with a saved key produces a reply.

### 5. Types
- Update `ModelCatalog` usage or replace with two narrower return types (one per fn). No DB migration.

## Out of scope

- No changes to persona/knowledge UI, chat widget UI, or DB schema.
- Not adding a server-side Ollama proxy — Ollama is inherently a "runs on the admin's device" feature, so the browser must reach it directly.

## Technical notes

- The admin's `getConciergeConfig` returns the raw key to the admin panel (needed to display/edit). This is acceptable because only authenticated admins can call it; the key never lands in `site_state` or any public route.
- Browser fetch to `http://localhost:11434` from an `https://` published site will be blocked as mixed content. Document this in the Ollama warning: use the admin panel on `http://` locally, or run Ollama with a TLS reverse proxy. (Local dev on `http://localhost:5173` works fine.)