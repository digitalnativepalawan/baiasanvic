/**
 * TALA agentic loop (SERVER-ONLY).
 *
 * This is the brain. One agent, two surfaces:
 *
 *   runGuestTurn()  — the full guest pipeline. The order of layers is the
 *                     battle-tested concierge flow (lead capture → price
 *                     guardrail → deterministic knowledge → Onyx → LLM →
 *                     contact fallback); the LLM layer is now an AGENTIC LOOP
 *                     with real tools instead of a single-pass completion.
 *
 *   runAdminTurn()  — passkey-gated owner console turn with write tools.
 *
 *   runAgentLoop()  — the generic observe → call tools → observe → answer
 *                     cycle used by both. The model function is injectable,
 *                     which is how the tests drive the loop without any
 *                     provider configured.
 *
 * DESIGN PRINCIPLE (inherited from the concierge): TALA must work for guests
 * with ZERO external providers configured. The deterministic layers always
 * run first; the agentic loop is a quality enhancer that never decides whether
 * TALA works at all. A provider outage mid-loop falls back to the deterministic
 * answer or the contact path — guests never see an error.
 */
import type { ConciergeConfig, ConciergeMessage } from "../../concierge.types";
import { loadConciergeConfig } from "../../concierge.config.server";
import { buildTalaGuestPrompt, buildTalaAdminPrompt } from "./tala.prompts";
import { retrieveRelevant, chunksToText } from "../../concierge.retrieve";
import { buildMenuAnswer, isMenuQuestion, isNoKnowledgeFallback } from "../../concierge.knowledge";
import { answerKnownTopic } from "../../concierge.answer";
import { loadDbKnowledgeChunks } from "../../concierge.knowledge.server";
import { logConciergeTurn } from "../../concierge.log.server";
import { detectIntent, sanitizeReply, APPROVED_RATE_RESPONSE } from "../../concierge.guardrails";
import { extractBookingInquiry, buildLeadConfirmationReply } from "../../concierge.leads";
import { handleCreateGuestLead, deriveGuestLeadIdempotencyKey } from "../../ops/guest-lead.server";
import { verifyAdminPasskey } from "../../admin.server";
import { getToolsForSurface, toToolSchemas, executeTool, type ToolContext } from "./tala.tools";
import {
  makeModelFn,
  historyToLoopMessages,
  type LoopMessage,
  type LoopTurnResult,
  type ToolSchema,
} from "./tala.llm";
import type { TalaAction } from "../tala.types";

const MAX_HISTORY_TURNS = 10;
const BAIA_RESORT_ID = "baia-san-vicente";

const CONTACT_FALLBACK_REPLY =
  "Thanks for your message! For anything I can't answer here, please email hello@baiapalawan.com " +
  "or use the Book Your Stay button and our team will follow up shortly.";

const ADMIN_UNAVAILABLE_REPLY =
  "I couldn't reach my language model just now, so I can't complete this request. " +
  "Everything I already saved is intact — try again in a moment, or check the AI Concierge settings " +
  "(provider + key) in the admin panel.";

// ---------------------------------------------------------------------------
// Generic agentic loop
// ---------------------------------------------------------------------------

export type ModelFn = (messages: LoopMessage[], tools: ToolSchema[]) => Promise<LoopTurnResult>;

export interface AgentLoopResult {
  reply: string;
  actions: TalaAction[];
  steps: number;
  toolCalls: number;
  error?: string;
}

export interface AgentLoopOptions {
  system: string;
  history: ConciergeMessage[];
  tools: ReturnType<typeof getToolsForSurface>;
  ctx: ToolContext;
  modelFn: ModelFn;
  /** Hard caps so a confused model can't loop forever. */
  maxSteps?: number;
  maxToolCalls?: number;
}

/**
 * The observe → act → observe → answer cycle.
 *
 * - The model sees the tool schemas each step.
 * - tool_calls are executed through executeTool() (surface-checked, logged,
 *   size-capped) and fed back as tool messages.
 * - The first content-only turn ends the loop with that reply.
 * - Caps: maxSteps model calls (default 6), maxToolCalls executions (default 12).
 *   On exhaustion the last non-empty content wins, else an error is reported.
 */
export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentLoopResult> {
  const maxSteps = opts.maxSteps ?? 6;
  const maxToolCalls = opts.maxToolCalls ?? 12;
  const schemas = toToolSchemas(opts.tools);
  const actions: TalaAction[] = [];

  const messages: LoopMessage[] = [
    { role: "system", content: opts.system },
    ...historyToLoopMessages(opts.history),
  ];

  let lastContent = "";
  let toolCallCount = 0;

  for (let step = 0; step < maxSteps; step++) {
    const turn = await opts.modelFn(messages, schemas);

    if (turn.toolCalls.length === 0) {
      // Final answer.
      const content = turn.content.trim();
      if (content) {
        return { reply: content, actions, steps: step + 1, toolCalls: toolCallCount };
      }
      // Empty content with no tool calls — nudge once, then give up.
      messages.push({ role: "assistant", content: "" });
      messages.push({
        role: "user",
        content: "Please answer with plain text now (you have all the information you need).",
      });
      lastContent = content;
      continue;
    }

    // Assistant turn that requested tools — echo it back with the calls.
    messages.push({
      role: "assistant",
      content: turn.content || "",
      tool_calls: turn.toolCalls,
    });

    for (const call of turn.toolCalls) {
      if (toolCallCount >= maxToolCalls) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify({
            ok: false,
            error: "Tool call budget for this turn is exhausted.",
          }),
        });
        continue;
      }
      toolCallCount++;
      const { result } = await executeTool(call.name, call.arguments, opts.ctx);
      actions.push({
        name: call.name,
        status: result.ok ? "success" : "error",
        evidenceJson: result.ok ? safeJson(result.data) : safeJson({ error: result.error }),
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        content: JSON.stringify(result.ok ? result.data : { error: result.error }),
      });
    }
  }

  if (lastContent.trim()) {
    return { reply: lastContent.trim(), actions, steps: maxSteps, toolCalls: toolCallCount };
  }
  return {
    reply: "",
    actions,
    steps: maxSteps,
    toolCalls: toolCallCount,
    error: "Agentic loop exhausted its step budget without a final answer.",
  };
}

function safeJson(v: unknown): string | undefined {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? undefined : s.slice(0, 400);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Guest turn (public site chat)
// ---------------------------------------------------------------------------

export interface GuestTurnResult {
  reply: string;
  intent?: string;
  approvalRequired?: boolean;
  databaseWriteDeferred?: boolean;
  sanitized?: boolean;
  brain: "deterministic" | "onyx" | "tala" | "fallback";
  onyxSessionId?: string;
  runId?: string;
  actions: TalaAction[];
}

function trimHistory(messages: ConciergeMessage[]): ConciergeMessage[] {
  const limit = MAX_HISTORY_TURNS * 2;
  if (messages.length <= limit) return messages;
  return messages.slice(messages.length - limit);
}

export async function runGuestTurn(params: {
  messages: ConciergeMessage[];
  sessionId: string;
  onyxSessionId?: string;
}): Promise<GuestTurnResult> {
  const history = trimHistory(params.messages);
  const lastGuest = [...history].reverse().find((m) => m.role === "guest");
  const question = lastGuest?.content ?? "";

  const cfg = await loadConciergeConfig();
  const onyxEnabled = process.env.ONYX_ENABLED === "true";
  const onyxConfigured = onyxEnabled && !!(process.env.ONYX_BASE_URL && process.env.ONYX_API_KEY);

  // -----------------------------------------------------------------------
  // 1. Qualified-lead detection & capture — deterministic, no LLM.
  // -----------------------------------------------------------------------
  const bookingInquiry = extractBookingInquiry(question);
  if (bookingInquiry) {
    try {
      const idemKey = deriveGuestLeadIdempotencyKey(params.sessionId, question);
      const evidence = await handleCreateGuestLead({
        resort_id: BAIA_RESORT_ID,
        idempotency_key: idemKey,
        channel: "website",
        guest: {
          name: bookingInquiry.name ?? undefined,
          email: bookingInquiry.email,
          phone: bookingInquiry.phone ?? undefined,
        },
        stay: {
          check_in: bookingInquiry.checkIn ?? undefined,
          check_out: bookingInquiry.checkOut ?? undefined,
          adults: bookingInquiry.adults ?? undefined,
        },
      });
      const reply = buildLeadConfirmationReply(!evidence.created);
      await logConciergeTurn(params.sessionId, "guest", question);
      await logConciergeTurn(params.sessionId, "agent", reply);
      return {
        reply,
        intent: "booking_inquiry",
        approvalRequired: false,
        databaseWriteDeferred: false,
        sanitized: false,
        brain: "deterministic",
        actions: [
          {
            name: "create_guest_lead",
            status: "success",
            evidenceJson: JSON.stringify(evidence).slice(0, 400),
          },
        ],
      };
    } catch (err) {
      // Never let lead-capture failure break the guest's turn.
      console.error("Guest lead capture failed:", err);
    }
  }

  // -----------------------------------------------------------------------
  // 2. Price/rate questions — deterministic, never sent to a model.
  // -----------------------------------------------------------------------
  const intent = detectIntent(question);
  if (intent.isRateQuestion) {
    await logConciergeTurn(params.sessionId, "guest", question);
    await logConciergeTurn(params.sessionId, "agent", APPROVED_RATE_RESPONSE);
    return {
      reply: APPROVED_RATE_RESPONSE,
      intent: intent.intent,
      approvalRequired: intent.approvalRequired,
      databaseWriteDeferred: intent.databaseWriteDeferred,
      sanitized: true,
      brain: "deterministic",
      actions: [],
    };
  }

  // -----------------------------------------------------------------------
  // 3. Known BAIA topics — answered directly from approved knowledge.
  // -----------------------------------------------------------------------
  const dbChunks = await loadDbKnowledgeChunks().catch(() => []);
  const deterministic = answerKnownTopic(question, dbChunks);
  if (deterministic) {
    await logConciergeTurn(params.sessionId, "guest", question);
    await logConciergeTurn(params.sessionId, "agent", deterministic.reply);
    return {
      reply: deterministic.reply,
      intent: intent.intent,
      approvalRequired: false,
      databaseWriteDeferred: false,
      sanitized: false,
      brain: "deterministic",
      actions: [],
    };
  }

  // -----------------------------------------------------------------------
  // 4. Onyx (optional external brain) — kept on standby unless explicitly
  //    enabled via ONYX_ENABLED=true.
  // -----------------------------------------------------------------------
  if (onyxConfigured) {
    try {
      const { createOnyxResortAgentClient } = await import("../../onyx/client.server");
      const onyx = createOnyxResortAgentClient();
      const onyxRes = await onyx.sendGuestEvent({
        resortId: BAIA_RESORT_ID,
        conversationId: params.sessionId,
        messageId: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        channel: "website",
        message: question,
        onyxSessionId: params.onyxSessionId,
      });
      const onyxReply = (onyxRes.reply ?? "").trim();
      if (!onyxRes.error && onyxReply.length > 0) {
        await logConciergeTurn(params.sessionId, "guest", question);
        await logConciergeTurn(params.sessionId, "agent", onyxReply);
        const finalReply =
          onyxRes.intent !== "booking_inquiry" &&
          isMenuQuestion(question) &&
          isNoKnowledgeFallback(onyxReply)
            ? buildMenuAnswer()
            : onyxReply;
        return {
          reply: finalReply,
          intent: onyxRes.intent,
          approvalRequired: onyxRes.approvalRequired,
          onyxSessionId: onyxRes.onyxSessionId,
          runId: onyxRes.runId,
          sanitized: false,
          brain: "onyx",
          actions: onyxRes.actions.map((a) => ({
            name: a.name,
            status: a.status === "success" ? ("success" as const) : ("error" as const),
            evidenceJson: a.evidence ? JSON.stringify(a.evidence).slice(0, 400) : undefined,
          })),
        };
      }
      if (onyxRes.error) {
        await logConciergeTurn(params.sessionId, "agent", "", {
          source: "onyx",
          onyxError: onyxRes.error,
        });
      }
      console.warn("Onyx returned no usable reply, trying TALA agentic loop:", onyxRes.error);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await logConciergeTurn(params.sessionId, "agent", "", { source: "onyx", onyxError: errMsg });
      console.error("Onyx enhancer failed, trying TALA agentic loop:", err);
    }
  }

  // -----------------------------------------------------------------------
  // 5. TALA agentic loop — model + tools (guest surface: read-only lookups
  //    + lead capture). Replies pass the same guardrail sanitizer as before.
  // -----------------------------------------------------------------------
  const modelFn = await makeModelFn(cfg).catch(() => null);
  if (cfg.enabled && modelFn) {
    try {
      const { chunks } = retrieveRelevant(question, cfg.customKnowledge, dbChunks);
      const knowledgeBlock = chunksToText(chunks);
      const system = buildTalaGuestPrompt(cfg, knowledgeBlock);
      const loop = await runAgentLoop({
        system,
        history,
        tools: getToolsForSurface("guest"),
        ctx: {
          surface: "guest",
          sessionId: params.sessionId,
          customKnowledge: cfg.customKnowledge,
        },
        modelFn,
      });

      if (loop.reply) {
        const menuFixed =
          isMenuQuestion(question) && isNoKnowledgeFallback(loop.reply)
            ? buildMenuAnswer()
            : loop.reply;
        const guarded = sanitizeReply(menuFixed, intent.intent);
        await logConciergeTurn(params.sessionId, "guest", question);
        await logConciergeTurn(params.sessionId, "agent", guarded.reply);
        return {
          reply: guarded.reply,
          intent: guarded.intent,
          approvalRequired: guarded.approvalRequired,
          databaseWriteDeferred: guarded.databaseWriteDeferred,
          sanitized: guarded.sanitized,
          brain: "tala",
          actions: loop.actions,
        };
      }
      console.error("TALA agentic loop ended without a reply:", loop.error);
    } catch (err) {
      console.error("TALA agentic loop failed, using contact fallback:", err);
    }
  }

  // -----------------------------------------------------------------------
  // 6. Nothing could answer — always give the guest a real path forward.
  // -----------------------------------------------------------------------
  await logConciergeTurn(params.sessionId, "guest", question);
  await logConciergeTurn(params.sessionId, "agent", CONTACT_FALLBACK_REPLY);
  return {
    reply: CONTACT_FALLBACK_REPLY,
    intent: intent.intent,
    approvalRequired: false,
    databaseWriteDeferred: false,
    sanitized: false,
    brain: "fallback",
    actions: [],
  };
}

// ---------------------------------------------------------------------------
// Admin turn (owner console)
// ---------------------------------------------------------------------------

export interface AdminTurnResult {
  reply: string;
  brain: "tala" | "deterministic" | "fallback" | "error";
  actions: TalaAction[];
  error?: string;
}

export async function runAdminTurn(params: {
  message: string;
  sessionId: string;
  passkey?: string;
  history?: ConciergeMessage[];
}): Promise<AdminTurnResult> {
  // Gate 1: passkey. Checked BEFORE any tool is reachable. On failure the
  // caller gets a clean error, not a hint.
  try {
    verifyAdminPasskey(params.passkey ?? "");
  } catch {
    return {
      reply: "Unauthorized — a valid admin passkey is required to use the TALA console.",
      brain: "error",
      actions: [],
      error: "invalid_passkey",
    };
  }

  const question = params.message.trim();
  if (!question) {
    return {
      reply: "Ask me anything about the resort's operations or content.",
      brain: "fallback",
      actions: [],
    };
  }

  const cfg: ConciergeConfig = await loadConciergeConfig();
  await logConciergeTurn(params.sessionId, "guest", question);

  const modelFn = await makeModelFn(cfg).catch(() => null);
  if (!modelFn) {
    const reply =
      "No language model is configured, so I can only run my deterministic layer. " +
      "Open the AI Concierge tab, enable the concierge, and set an OpenRouter key or an Ollama model — " +
      "then I can act on bookings, knowledge, and site content for you.";
    await logConciergeTurn(params.sessionId, "agent", reply);
    return { reply, brain: "fallback", actions: [] };
  }

  try {
    const loop = await runAgentLoop({
      system: buildTalaAdminPrompt(cfg),
      history: params.history ?? [{ role: "guest", content: question }],
      tools: getToolsForSurface("admin"),
      ctx: {
        surface: "admin",
        sessionId: params.sessionId,
        customKnowledge: cfg.customKnowledge,
        adminVerified: true,
      },
      modelFn,
      maxSteps: 8,
      maxToolCalls: 16,
    });

    const reply = loop.reply || ADMIN_UNAVAILABLE_REPLY;
    await logConciergeTurn(params.sessionId, "agent", reply);
    return {
      reply,
      brain: "tala",
      actions: loop.actions,
      error: loop.reply ? undefined : loop.error,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("TALA admin turn failed:", err);
    await logConciergeTurn(params.sessionId, "agent", "", { onyxError: errMsg });
    return {
      reply: ADMIN_UNAVAILABLE_REPLY,
      brain: "error",
      actions: [],
      error: errMsg,
    };
  }
}
