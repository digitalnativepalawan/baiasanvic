/**
 * Admin panel: AI Concierge settings.
 *
 * Lets the resort owner:
 *  - enable/disable the concierge
 *  - choose provider: OpenRouter (their own key) or local Ollama
 *  - pick a model from a dropdown:
 *      * OpenRouter — live list from https://openrouter.ai/api/v1/models
 *        (fetched via a server fn to avoid CORS; free models flagged).
 *      * Ollama — fetched DIRECTLY FROM THE BROWSER against the admin's own
 *        machine (the server can't reach the admin's localhost).
 *  - edit the persona + extra knowledge
 *
 * The OpenRouter key is only sent to the server function; it is never stored
 * in the browser bundle or in the public `site_state`.
 */
import { useState, useEffect, useCallback } from "react";
import { Save, Check, Loader2, AlertTriangle, Info } from "lucide-react";
import {
  getConciergeConfig,
  saveConciergeSettings,
  getOpenRouterModels,
} from "../concierge.admin.functions";
import {
  listOllamaModelsBrowser,
  type OllamaBrowserResult,
} from "../concierge.discovery";
import type { ConciergeConfig } from "../concierge.types";

export default function ConciergeSettings() {
  const [cfg, setCfg] = useState<ConciergeConfig | null>(null);
  const [openrouterModels, setOpenrouterModels] = useState<string[]>([]);
  const [openrouterError, setOpenrouterError] = useState<string | null>(null);
  const [ollamaResult, setOllamaResult] = useState<OllamaBrowserResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const refreshOpenRouter = useCallback(async () => {
    try {
      const res = await getOpenRouterModels();
      setOpenrouterModels(res.models);
      setOpenrouterError(res.error ?? null);
    } catch (e) {
      setOpenrouterModels([]);
      setOpenrouterError(e instanceof Error ? e.message : "Failed to fetch models");
    }
  }, []);

  const refreshOllama = useCallback(async (baseUrl: string) => {
    const result = await listOllamaModelsBrowser(baseUrl);
    setOllamaResult(result);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await getConciergeConfig();
        setCfg(c);
        // Kick off the appropriate discovery for the loaded provider.
        if (c.provider === "openrouter") {
          void refreshOpenRouter();
        } else {
          void refreshOllama(c.ollamaBaseUrl || "http://localhost:11434");
        }
      } catch (e) {
        console.error("Failed to load concierge settings", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshOpenRouter, refreshOllama]);

  const refreshCurrent = async () => {
    if (!cfg) return;
    setRefreshingModels(true);
    try {
      if (cfg.provider === "openrouter") {
        await refreshOpenRouter();
      } else {
        await refreshOllama(cfg.ollamaBaseUrl || "http://localhost:11434");
      }
    } finally {
      setRefreshingModels(false);
    }
  };

  const update = (patch: Partial<ConciergeConfig>) => {
    if (!cfg) return;
    const next = { ...cfg, ...patch };
    setCfg(next);
    setDirty(true);
    setSaved(false);
    // If provider just switched, trigger the right discovery.
    if (patch.provider && patch.provider !== cfg.provider) {
      if (patch.provider === "openrouter") {
        void refreshOpenRouter();
      } else {
        void refreshOllama(next.ollamaBaseUrl || "http://localhost:11434");
      }
    }
  };

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await saveConciergeSettings({ data: { config: cfg } });
      setDirty(false);
      setSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !cfg) {
    return (
      <div className="flex items-center gap-2 text-luxury-400 text-xs font-sans">
        <Loader2 size={14} className="animate-spin" /> Loading concierge settings…
      </div>
    );
  }

  const ollamaModels = ollamaResult?.status === "ok" ? ollamaResult.models : [];
  const ollamaReady = cfg.provider === "ollama" && ollamaModels.length > 0;
  const openrouterReady = cfg.provider === "openrouter" && !!cfg.openrouterApiKey;

  return (
    <div className="space-y-8 text-left">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-1">
            AI Concierge
          </h3>
          <p className="text-xs text-luxury-400 font-sans font-light">
            A chat assistant for your guests. It answers from your site's knowledge, never
            quotes prices, and points guests to Book Your Stay. Choose OpenRouter (your own
            key) or a local Ollama model.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center space-x-2 bg-gold-500 hover:bg-gold-600 text-white px-5 py-3 text-[11px] tracking-widest uppercase font-sans font-bold rounded-sm cursor-pointer disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span>{saving ? "Saving" : "Save Settings"}</span>
        </button>
      </div>

      {/* Enable + provider */}
      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-widest text-gold-300 font-sans uppercase font-bold">
              Concierge Status
            </p>
            <p className="text-xs text-luxury-400 font-sans font-light">
              When off, guests see a polite "coming soon" message.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-luxury-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              className="accent-gold-500 w-4 h-4"
            />
            <span className="uppercase tracking-wider">{cfg.enabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>

        <div>
          <p className="text-[10px] tracking-widest text-gold-300 font-sans uppercase font-bold mb-2">
            Provider
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["ollama", "openrouter"] as const).map((p) => (
              <button
                key={p}
                onClick={() => update({ provider: p })}
                className={`px-4 py-3 rounded-sm border text-xs font-sans uppercase tracking-wider transition-all cursor-pointer ${
                  cfg.provider === p
                    ? "border-gold-300 text-gold-300 bg-gold-500/10"
                    : "border-luxury-800 text-luxury-400 hover:text-luxury-100"
                }`}
              >
                {p === "ollama" ? "Local Ollama" : "OpenRouter"}
              </button>
            ))}
          </div>
        </div>

        {/* OpenRouter fields */}
        {cfg.provider === "openrouter" && (
          <div className="space-y-4 border-t border-luxury-900 pt-4">
            <div className="flex items-start gap-2 text-xs text-gold-400 font-sans leading-relaxed bg-gold-500/5 p-3 border border-gold-500/10 rounded">
              <Info size={14} className="shrink-0 mt-0.5 text-gold-300" />
              <div>
                Paste <b>your own</b> OpenRouter API key. You pay per token on your OpenRouter
                account — MerQato never bills you. The key is stored server-side only.
              </div>
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
                OpenRouter API Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={cfg.openrouterApiKey}
                  onChange={(e) => update({ openrouterApiKey: e.target.value })}
                  placeholder="sk-or-..."
                  className="flex-1 bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-mono"
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="px-3 py-2 border border-luxury-800 text-luxury-300 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
                Model
              </label>
              <div className="flex gap-2">
                <select
                  value={cfg.openrouterModel}
                  onChange={(e) => update({ openrouterModel: e.target.value })}
                  className="flex-1 bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300"
                >
                  {cfg.openrouterModel && !openrouterModels.includes(cfg.openrouterModel) && (
                    <option value={cfg.openrouterModel}>{cfg.openrouterModel} (current)</option>
                  )}
                  {openrouterModels.length === 0 && (
                    <option value="">No models fetched</option>
                  )}
                  {openrouterModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                      {m.includes(":free") ? " · FREE" : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={refreshCurrent}
                  disabled={refreshingModels}
                  className="px-3 py-2 border border-luxury-800 text-luxury-300 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer disabled:opacity-40"
                >
                  {refreshingModels ? "…" : "Refresh"}
                </button>
              </div>
              {openrouterError ? (
                <p className="text-[10px] text-amber-400 font-sans">
                  Couldn't fetch OpenRouter models: {openrouterError}
                </p>
              ) : (
                <p className="text-[10px] text-luxury-500 font-sans">
                  {openrouterModels.length} models available. Free ones are flagged ·FREE and
                  sorted to the top.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Ollama fields */}
        {cfg.provider === "ollama" && (
          <div className="space-y-4 border-t border-luxury-900 pt-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
                Ollama Base URL (on your device)
              </label>
              <input
                value={cfg.ollamaBaseUrl}
                onChange={(e) => update({ ollamaBaseUrl: e.target.value })}
                placeholder="http://localhost:11434"
                className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-mono"
              />
              <p className="text-[10px] text-luxury-500 font-sans">
                The admin panel fetches models directly from your browser — the server can't
                see your localhost.
              </p>
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
                Model (auto-detected from your device)
              </label>
              <div className="flex gap-2">
                <select
                  value={cfg.ollamaModel}
                  onChange={(e) => update({ ollamaModel: e.target.value })}
                  className="flex-1 bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300"
                >
                  <option value="">Auto (pick best available)</option>
                  {cfg.ollamaModel && !ollamaModels.includes(cfg.ollamaModel) && (
                    <option value={cfg.ollamaModel}>{cfg.ollamaModel} (saved)</option>
                  )}
                  {ollamaModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  onClick={refreshCurrent}
                  disabled={refreshingModels}
                  className="px-3 py-2 border border-luxury-800 text-luxury-300 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer disabled:opacity-40"
                >
                  {refreshingModels ? "…" : "Refresh"}
                </button>
              </div>

              {/* Status messaging */}
              {ollamaResult?.status === "ok" && (
                <p className="text-[10px] text-emerald-400 font-sans">
                  Detected {ollamaResult.models.length}: {ollamaResult.models.join(", ")}
                </p>
              )}
              {ollamaResult?.status === "empty" && (
                <p className="text-[10px] text-amber-400 font-sans">
                  Ollama is reachable but has no models installed. Run e.g.{" "}
                  <code className="text-luxury-200">ollama pull llama3.1</code>.
                </p>
              )}
              {ollamaResult?.status === "cors_or_down" && (
                <div className="flex items-start gap-2 text-[10px] text-amber-400 font-sans bg-amber-500/5 border border-amber-500/20 p-2 rounded">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>{ollamaResult.message}</span>
                </div>
              )}
              {ollamaResult?.status === "mixed_content" && (
                <div className="flex items-start gap-2 text-[10px] text-amber-400 font-sans bg-amber-500/5 border border-amber-500/20 p-2 rounded">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>{ollamaResult.message}</span>
                </div>
              )}
              {ollamaResult?.status === "http_error" && (
                <p className="text-[10px] text-amber-400 font-sans">
                  Ollama returned HTTP {ollamaResult.code}. Check the base URL.
                </p>
              )}

              <p className="text-[10px] text-luxury-500 font-sans">
                Note: Ollama runs on a device with the model installed. For the live hosted
                site, OpenRouter is the always-works choice.
              </p>
            </div>
          </div>
        )}

        {/* Readiness indicator */}
        {cfg.enabled && !ollamaReady && !openrouterReady && (
          <div className="flex items-center gap-2 text-[11px] text-amber-400 font-sans bg-amber-500/5 border border-amber-500/20 p-3 rounded">
            <AlertTriangle size={14} />
            <span>
              Concierge is enabled but not ready: add an OpenRouter key, or make sure Ollama is
              running with a model.
            </span>
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-sans bg-emerald-500/5 border border-emerald-500/20 p-3 rounded">
            <Check size={14} /> Settings saved.
          </div>
        )}
      </div>

      {/* Persona + knowledge */}
      <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm space-y-4">
        <p className="text-[10px] tracking-widest text-gold-300 font-sans uppercase font-bold">
          Persona &amp; Knowledge
        </p>
        <div className="flex flex-col space-y-1.5">
          <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
            Persona (tone & role)
          </label>
          <textarea
            value={cfg.persona}
            onChange={(e) => update({ persona: e.target.value })}
            rows={4}
            className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-sans leading-relaxed"
          />
        </div>
        <div className="flex flex-col space-y-1.5">
          <label className="text-[10px] tracking-wider text-luxury-400 font-sans uppercase">
            Extra knowledge (optional)
          </label>
          <textarea
            value={cfg.customKnowledge}
            onChange={(e) => update({ customKnowledge: e.target.value })}
            rows={5}
            placeholder="Add anything not already on the site — special packages, FAQs, policies…"
            className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-sans leading-relaxed"
          />
          <p className="text-[10px] text-luxury-500 font-sans">
            Rooms, experiences, and the area are pulled automatically from your site content.
            The agent never sees prices — it always directs guests to Book Your Stay.
          </p>
        </div>
      </div>
    </div>
  );
}
