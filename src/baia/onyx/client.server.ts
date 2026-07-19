/**
 * OnyxResortAgentClient (SERVER-ONLY).
 *
 * The single server-side boundary between BAIA and the Onyx runtime. The browser
 * NEVER imports or calls this — only concierge.server.ts (server function) does.
 *
 * It speaks Onyx's REAL HTTP contract (verified against the Onyx source):
 *   - POST {ONYX_BASE_URL}/chat/create-chat-session   -> { chat_session_id }
 *       body: ChatSessionCreationRequest { persona_id }
 *   - POST {ONYX_BASE_URL}/chat/send-chat-message      -> ChatFullResponse
 *       body: SendMessageRequest {
 *         message, chat_session_id | chat_session_info{persona_id},
 *         stream: false, ...
 *       }
 *       ChatFullResponse { answer, tool_calls[], message_id, chat_session_id, error_msg }
 *
 * Auth: Onyx API key in the Authorization header (server-held ONYX_API_KEY).
 * The Resort Agent persona (with the create_guest_lead custom tool attached and
 * the resort-agent skill enabled) is selected by ONYX_RESORT_PERSONA_ID.
 *
 * NOTE: This does NOT give Onyx Supabase access. Onyx's create_guest_lead tool
 * calls BAIA's /api/ops/guest-lead endpoint (see src/baia/ops/guest-lead.server.ts),
 * which is the only component holding Supabase credentials.
 */

import { createHash } from "node:crypto";

/**
 * Deterministic idempotency key for a guest inquiry.
 *
 * Onyx's create_guest_lead tool has NO server-side idempotency_key generation —
 * the LLM composes it from the conversation, which is non-deterministic and
 * produces a fresh key (and thus a duplicate lead) on every retry. To make the
 * same confirmed inquiry reuse the same key, we derive a STABLE key from the
 * request's identity:
 *   - conversationId (the session the inquiry belongs to)
 *   - a normalized form of the inquiry text
 * and surface it to the persona so the tool call carries the same key on retry.
 *
 * No timestamp, no random — identical inquiry => identical key.
 */
function normalizeInquiry(message: string): string {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function deriveIdempotencyKey(conversationId: string, message: string): string {
  const basis = `${conversationId}|${normalizeInquiry(message)}`;
  const hash = createHash("sha256").update(basis).digest("hex").slice(0, 24);
  return `baia-${hash}`;
}

export interface OnyxGuestEventInput {
  resortId: string;
  conversationId: string;
  messageId: string;
  channel: "website";
  message: string;
  guest?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  /** Existing Onyx chat session to resume, if any. */
  onyxSessionId?: string;
}

export interface OnyxToolActivity {
  name: string;
  status: "success" | "error" | "unknown";
  evidence?: Record<string, unknown> | null;
}

export interface OnyxGuestEventResult {
  reply: string;
  intent: string;
  actions: OnyxToolActivity[];
  approvalRequired: boolean;
  onyxSessionId?: string;
  runId?: string; // Onyx message_id acts as the per-turn run identifier
  error?: string;
}

interface OnyxClientConfig {
  baseUrl: string;
  apiKey: string;
  personaId: number;
  timeoutMs: number;
}

function loadConfig(): OnyxClientConfig {
  const baseUrl = process.env.ONYX_BASE_URL;
  const apiKey = process.env.ONYX_API_KEY;
  const personaId = process.env.ONYX_RESORT_PERSONA_ID;
  if (!baseUrl) throw new Error("ONYX_BASE_URL not configured");
  if (!apiKey) throw new Error("ONYX_API_KEY not configured");
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    personaId: personaId ? Number(personaId) : 0,
    // Short timeout so an unreachable Onyx tunnel does not hang the guest turn;
    // concierge.server.ts falls back to the OpenRouter core immediately.
    timeoutMs: Number(process.env.ONYX_TIMEOUT_MS ?? 6000),
  };
}

async function onyxFetch(cfg: OnyxClientConfig, path: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    return await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: cfg.apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Onyx ToolCallResponse shape (subset we consume). */
interface OnyxToolCall {
  tool_name?: string;
  tool_result?: unknown;
  [k: string]: unknown;
}

interface OnyxChatFullResponse {
  answer?: string;
  tool_calls?: OnyxToolCall[];
  message_id?: number;
  chat_session_id?: string;
  error_msg?: string;
}

function mapToolActivity(tc: OnyxToolCall): OnyxToolActivity {
  // Onyx wraps the tool result in inconsistent shapes. Recursively dig for the
  // inner payload that carries { ok, lead_id, ... } so the widget can confirm.
  const dig = (val: unknown, depth = 0): Record<string, unknown> | null => {
    if (!val || depth > 6) return null;
    if (typeof val === "string") {
      try {
        return dig(JSON.parse(val), depth + 1);
      } catch {
        return null;
      }
    }
    if (Array.isArray(val)) {
      for (const v of val) {
        const r = dig(v, depth + 1);
        if (r) return r;
      }
      return null;
    }
    if (typeof val === "object") {
      const o = val as Record<string, unknown>;
      if (typeof o.ok === "boolean" && "lead_id" in o) return o;
      for (const k of Object.keys(o)) {
        const r = dig(o[k], depth + 1);
        if (r) return r;
      }
    }
    return null;
  };

  const result = dig(tc.tool_result);
  let status: OnyxToolActivity["status"] = "unknown";
  if (result && typeof result.ok === "boolean") status = result.ok ? "success" : "error";

  const evidence = result ?? (tc.tool_result != null ? { value: tc.tool_result } : null);
  return { name: tc.tool_name ?? "unknown", status, evidence };
}

/**
 * Honest reachability check for the admin "Live status" panel.
 *
 * Does the exact same first call a real guest turn depends on
 * (POST /chat/create-chat-session) with a short timeout, so "Onyx" is only
 * reported as the active provider when it would ACTUALLY answer a guest —
 * not just when ONYX_BASE_URL/ONYX_API_KEY happen to be set. A Cloudflare
 * edge error (e.g. a stale quick-tunnel hostname returning 403) counts as
 * unreachable, same as a network failure, because guests would see the same
 * OpenRouter fallback either way.
 */
export async function probeOnyxReachable(): Promise<boolean> {
  let cfg: OnyxClientConfig;
  try {
    cfg = loadConfig();
  } catch {
    return false;
  }
  try {
    const res = await onyxFetch(
      { ...cfg, timeoutMs: Math.min(cfg.timeoutMs, 4000) },
      "/chat/create-chat-session",
      { persona_id: cfg.personaId },
    );
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { chat_session_id?: string } | null;
    return !!body?.chat_session_id;
  } catch {
    return false;
  }
}

export function createOnyxResortAgentClient() {
  return {
    async sendGuestEvent(input: OnyxGuestEventInput): Promise<OnyxGuestEventResult> {
      const cfg = loadConfig();

      // 1. Resume or create the Onyx chat session.
      let sessionId = input.onyxSessionId;
      if (!sessionId) {
        const createRes = await onyxFetch(cfg, "/chat/create-chat-session", {
          persona_id: cfg.personaId,
        });
        if (!createRes.ok) {
          return errResult(`create-chat-session failed: HTTP ${createRes.status}`);
        }
        const created = (await createRes.json()) as { chat_session_id?: string };
        sessionId = created.chat_session_id;
        if (!sessionId) return errResult("create-chat-session returned no id");
      }
      // 2. Send the guest message (non-streaming JSON response).
      // Inject the deterministic idempotency key into the conversation so the
      // persona reuses it on retries of the same confirmed inquiry (prevents
      // duplicate leads). The key is derived from stable request identity only.
      const idemKey = deriveIdempotencyKey(input.conversationId, input.message);
      const augmentedMessage = `${input.message}\n\n[idempotency_key: ${idemKey}]`;
      const sendRes = await onyxFetch(cfg, "/chat/send-chat-message", {
        message: augmentedMessage,
        chat_session_id: sessionId,
        stream: false,
        // Persona (already configured with the resort-agent skill + tool) drives
        // tool selection. We do not force the tool so we can prove the LLM chooses it.
      });
      if (!sendRes.ok) {
        return errResult(`send-chat-message failed: HTTP ${sendRes.status}`, sessionId);
      }

      const data = (await sendRes.json()) as OnyxChatFullResponse;
      if (data.error_msg) {
        return errResult(data.error_msg, sessionId);
      }

      const actions = (data.tool_calls ?? []).map(mapToolActivity);
      const approvalRequired = actions.some((a) => a.name === "request_approval");

      return {
        reply: data.answer ?? "",
        intent: inferIntent(actions),
        actions,
        approvalRequired,
        onyxSessionId: data.chat_session_id ?? sessionId,
        runId: data.message_id != null ? String(data.message_id) : undefined,
      };
    },
  };
}

function inferIntent(actions: OnyxToolActivity[]): string {
  if (actions.some((a) => a.name === "create_guest_lead")) return "booking_inquiry";
  if (actions.some((a) => a.name === "request_approval")) return "approval_required";
  if (actions.length === 0) return "general";
  return actions[0].name;
}

function errResult(error: string, onyxSessionId?: string): OnyxGuestEventResult {
  return {
    reply:
      "Thanks for your message! Our team will follow up shortly. You can also email hello@baiapalawan.com or use the Book Your Stay button.",
    intent: "error",
    actions: [],
    approvalRequired: false,
    onyxSessionId,
    error,
  };
}

export type OnyxResortAgentClient = ReturnType<typeof createOnyxResortAgentClient>;
