/**
 * TALA server functions (SERVER-ONLY).
 *
 * One brain, two surfaces:
 *   - talaChat({surface: "guest"})  → the public site chat (same pipeline the
 *     concierge widget uses, with guest guardrails + read-only tools).
 *   - talaChat({surface: "admin"})  → the owner console. Requires the admin
 *     passkey (verified before any tool runs) and unlocks write tools over
 *     site content, knowledge, bookings, and operations tables.
 *
 * Also exposes:
 *   - talaStatus() — real readiness/reporting for the admin console (which
 *     provider is live, knowledge size, pending inquiries, recent actions).
 *   - getTalaActionLog() — the evidence trail of every tool TALA executed.
 *
 * There is no external "TALA API" anymore: the earlier localhost:8100 Python
 * proxy could only run on one machine and returned empty replies everywhere
 * else. The agent now lives in these server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import type {
  TalaChatRequest,
  TalaChatResponse,
  TalaStatus,
  TalaActionLogEntry,
} from "./tala.types";
import { runGuestTurn, runAdminTurn } from "./agent/tala.loop";
import { listToolNames } from "./agent/tala.tools";
import { listTalaActions } from "./agent/tala.actions";
import { providerUsable } from "./agent/tala.llm";
import { loadConciergeConfig } from "../concierge.config.server";
import { buildStaticChunks } from "../concierge.knowledge";

export const talaChat = createServerFn({ method: "POST" })
  .inputValidator((data: TalaChatRequest) => data)
  .handler(async ({ data }): Promise<TalaChatResponse> => {
    const sessionId = data.sessionId || "anonymous";

    if (data.surface === "admin") {
      const turn = await runAdminTurn({
        message: data.message,
        sessionId,
        passkey: data.passkey,
        history: data.history,
      });
      return {
        reply: turn.reply,
        brain: turn.brain,
        actions: turn.actions,
        error: turn.error,
      };
    }

    // Guest surface — same guarded pipeline the concierge widget uses.
    const history = data.history ?? [];
    const turn = await runGuestTurn({
      messages: [...history, { role: "guest", content: data.message }],
      sessionId,
    });
    return {
      reply: turn.reply,
      brain: turn.brain,
      actions: turn.actions,
    };
  });

export const getTalaStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<TalaStatus> => {
    const notes: string[] = [];
    const cfg = await loadConciergeConfig().catch(() => null);
    const provider = cfg ? providerUsable(cfg) : null;

    if (!cfg || !provider) {
      notes.push(
        "No LLM provider configured — TALA answers guests from the deterministic knowledge layer. Set a provider in the AI Concierge tab to enable the agentic loop.",
      );
    }
    if (cfg && !cfg.enabled) {
      notes.push(
        "The concierge is switched off (AI Concierge tab). Guests get the contact fallback for unknown questions.",
      );
    }

    let knowledgeEntries = 0;
    let pendingInquiries = 0;
    let actionsLast24h = 0;
    let databaseReachable = true;
    let actionLogAvailable = true;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [kn, inq] = await Promise.all([
        supabaseAdmin.from("concierge_knowledge").select("id").eq("enabled", true).limit(500),
        supabaseAdmin.from("booking_inquiries").select("status").eq("status", "pending").limit(500),
      ]);
      if (kn.error || inq.error) {
        databaseReachable = false;
        notes.push(
          "Supabase reachable but a query failed — check the concierge_knowledge / booking_inquiries tables.",
        );
      } else {
        knowledgeEntries = (kn.data ?? []).length;
        pendingInquiries = (inq.data ?? []).length;
      }
    } catch {
      databaseReachable = false;
      notes.push(
        "Supabase is not reachable from this environment — data tools will degrade gracefully.",
      );
    }

    const actions = await listTalaActions(100);
    if (actions.length === 0) actionLogAvailable = false;
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    actionsLast24h = actions.filter((a) => new Date(a.created_at).getTime() > dayAgo).length;
    if (!actionLogAvailable) {
      notes.push(
        "Action log is empty or unavailable — apply supabase/manual_sql/004_tala_agent.sql to record every tool execution.",
      );
    }

    const staticTopics = buildStaticChunks().length;

    return {
      status:
        provider && databaseReachable
          ? "online"
          : provider || databaseReachable
            ? "degraded"
            : "offline",
      provider: provider ?? "none",
      model:
        provider === "openrouter"
          ? cfg?.openrouterModel || "openai/gpt-4o-mini"
          : provider === "ollama"
            ? cfg?.ollamaModel || "(auto-discover)"
            : "none",
      knowledgeLayerReady: true, // static approved knowledge is always compiled in
      knowledgeEntries,
      staticTopics,
      pendingInquiries,
      actionsLast24h,
      tools: { guest: listToolNames("guest"), admin: listToolNames("admin") },
      databaseReachable,
      notes,
    };
  },
);

export const getTalaActionLog = createServerFn({ method: "POST" })
  .inputValidator((data: { passkey?: string; limit?: number }) => data)
  .handler(
    async ({ data }): Promise<{ ok: boolean; entries?: TalaActionLogEntry[]; error?: string }> => {
      // The trail contains tool arguments (which can include guest emails),
      // so it is strictly owner-facing: passkey required, verified server-side.
      const { verifyAdminPasskey } = await import("../admin.server");
      try {
        verifyAdminPasskey(data.passkey ?? "");
      } catch {
        return { ok: false, error: "Unauthorized — admin passkey required." };
      }
      return { ok: true, entries: await listTalaActions(data?.limit ?? 25) };
    },
  );
