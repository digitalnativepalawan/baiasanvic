/**
 * TALA agent core tests — real, dependency-free (no DB, no LLM provider).
 * Run: node --experimental-strip-types --test src/baia/__tests__/tala.agent.test.ts
 *
 * Covers the three properties that make TALA safe and agentic:
 *   1. SURFACE SEPARATION — guest surface can never reach admin tools, and
 *      admin tools refuse to execute without a verified admin context.
 *   2. THE AGENTIC LOOP — a model that requests tools gets them executed,
 *      results are fed back, and the final reply is returned with an
 *      evidence trail. Budgets stop runaway loops.
 *   3. GUEST-SIDE SAFETY — everything a tool returns on the guest surface is
 *      price-scrubbed before the model ever sees it; the guest turn still
 *      answers deterministically with zero providers configured.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getToolsForSurface,
  listToolNames,
  toToolSchemas,
  executeTool,
  guestSafe,
} from "../tala/agent/tala.tools.ts";
import { runAgentLoop, runGuestTurn, runAdminTurn } from "../tala/agent/tala.loop.ts";
import type { ModelFn } from "../tala/agent/tala.loop.ts";
import { APPROVED_RATE_RESPONSE, scanForMoney } from "../concierge.guardrails.ts";

const GUEST_CTX = { surface: "guest" as const, sessionId: "test-guest" };
const ADMIN_CTX = {
  surface: "admin" as const,
  sessionId: "test-admin",
  adminVerified: true,
};

// ---------------------------------------------------------------------------
// 1. Surface separation
// ---------------------------------------------------------------------------

test("guest surface exposes only read tools + lead capture", () => {
  const names = listToolNames("guest");
  assert.ok(names.includes("search_knowledge"));
  assert.ok(names.includes("list_rooms"));
  assert.ok(names.includes("create_booking_lead"));
  const forbidden = [
    "update_site_content",
    "update_booking_inquiry_status",
    "upsert_knowledge_entry",
    "update_tala_room_status",
    "create_housekeeping_task",
    "get_daily_pulse",
  ];
  for (const f of forbidden) assert.ok(!names.includes(f), `${f} must not be on guest surface`);
});

test("admin surface includes guest tools plus write tools", () => {
  const names = listToolNames("admin");
  assert.ok(names.includes("search_knowledge"));
  assert.ok(names.includes("update_site_content"));
  assert.ok(names.includes("update_booking_inquiry_status"));
});

test("admin tool refuses to execute on the guest surface", async () => {
  const { result } = await executeTool(
    "update_site_content",
    '{"path":"hero.title","value":"x"}',
    GUEST_CTX,
  );
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /not available on the guest surface/i);
});

test("admin tool refuses without a verified passkey context", async () => {
  const { result } = await executeTool("list_booking_inquiries", "{}", {
    surface: "admin",
    sessionId: "sneaky",
    adminVerified: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /admin surface with a verified passkey/i);
});

test("unknown tool is rejected, not invented", async () => {
  const { result } = await executeTool("delete_everything", "{}", ADMIN_CTX);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /unknown tool/i);
});

test("tool schemas are valid OpenAI function shapes", () => {
  const schemas = toToolSchemas(getToolsForSurface("guest"));
  assert.ok(schemas.length >= 5);
  for (const s of schemas) {
    assert.equal(s.type, "function");
    assert.equal(typeof s.function.name, "string");
    assert.equal(typeof s.function.description, "string");
    assert.ok(s.function.parameters && typeof s.function.parameters === "object");
  }
});

// ---------------------------------------------------------------------------
// 2. Guest-safety of tool outputs
// ---------------------------------------------------------------------------

test("guestSafe drops price-like keys and strips monetary strings", () => {
  const input = {
    name: "Deluxe Beachfront Suite",
    pricePerNight: 480,
    total_price: 1920,
    description: "King bed and sea view, starting from ₱4,800 per night",
    nested: { rate: 100, note: "The transfer is $200 per person" },
    capacity: "sleeps up to 4",
  };
  const out = guestSafe(input) as Record<string, unknown>;
  assert.equal("pricePerNight" in out, false);
  assert.equal("total_price" in out, false);
  const nested = out.nested as Record<string, unknown>;
  assert.equal("rate" in nested, false);
  assert.equal(scanForMoney(String(out.description)).hasMoney, false);
  assert.equal(scanForMoney(String(nested.note)).hasMoney, false);
  assert.equal(out.capacity, "sleeps up to 4");
  // No currency tokens anywhere in the scrubbed payload.
  const json = JSON.stringify(out);
  assert.equal(/₱|\$|\bphp\b|\busd\b/i.test(json), false, `currency leaked: ${json}`);
});

test("list_rooms on the guest surface returns price-free data", async () => {
  // No DB configured in tests → falls back to static ROOMS (which DO have
  // pricePerNight) and must still come back scrubbed: no price fields, no
  // currency tokens, no per-night phrasing. (scanForMoney's bare-number
  // heuristic would false-positive on "20–22 m²", so assert on the specific
  // monetary signals instead.)
  const { result } = await executeTool("list_rooms", "{}", GUEST_CTX);
  assert.equal(result.ok, true);
  const json = JSON.stringify(result.data);
  assert.ok(/Comfort Cottage/.test(json));
  assert.equal(
    /pricePerNight|price_per_night|totalPrice|total_price/i.test(json),
    false,
    `price field leaked: ${json.slice(0, 300)}`,
  );
  assert.equal(
    /₱|\$|\bphp\b|\busd\b|per night|nightly/i.test(json),
    false,
    `currency leaked: ${json.slice(0, 300)}`,
  );
});

test("search_knowledge answers from static chunks without any DB", async () => {
  const { result } = await executeTool(
    "search_knowledge",
    '{"query":"how do I get to the resort"}',
    GUEST_CTX,
  );
  assert.equal(result.ok, true);
  const data = result.data as { found: boolean; knowledge?: string };
  assert.equal(data.found, true);
  assert.ok(/transfers|airport/i.test(data.knowledge ?? ""));
});

// ---------------------------------------------------------------------------
// 3. The agentic loop (injected model — no provider needed)
// ---------------------------------------------------------------------------

/** Fake model that first calls a tool, then answers using nothing. */
function toolThenAnswerModel(toolName: string, args: string, final: string): ModelFn {
  let called = false;
  return async (_messages, _tools) => {
    if (!called) {
      called = true;
      return {
        content: "",
        toolCalls: [{ id: "call_1", name: toolName, arguments: args }],
      };
    }
    return { content: final, toolCalls: [] };
  };
}

test("loop executes a requested tool and returns the final reply + evidence", async () => {
  const model = toolThenAnswerModel(
    "search_knowledge",
    '{"query":"rooms"}',
    "BAIA has a Comfort Cottage and a Deluxe Beachfront Suite — both with AC, hot water, and private bathrooms.",
  );
  const res = await runAgentLoop({
    system: "test system",
    history: [{ role: "guest", content: "What rooms do you have?" }],
    tools: getToolsForSurface("guest"),
    ctx: GUEST_CTX,
    modelFn: model,
  });
  assert.equal(res.reply.includes("Comfort Cottage"), true);
  assert.equal(res.actions.length, 1);
  assert.equal(res.actions[0].name, "search_knowledge");
  assert.equal(res.actions[0].status, "success");
  assert.ok(res.steps >= 2);
  assert.equal(res.toolCalls, 1);
});

test("loop feeds tool results back to the model as tool messages", async () => {
  let seenToolMessage: string | null = null;
  const model: ModelFn = async (messages) => {
    const toolMsgs = messages.filter((m) => m.role === "tool");
    if (toolMsgs.length > 0) {
      seenToolMessage = toolMsgs[toolMsgs.length - 1].content;
      return { content: "done", toolCalls: [] };
    }
    return {
      content: "",
      toolCalls: [{ id: "c1", name: "list_rooms", arguments: "{}" }],
    };
  };
  await runAgentLoop({
    system: "s",
    history: [{ role: "guest", content: "rooms?" }],
    tools: getToolsForSurface("guest"),
    ctx: GUEST_CTX,
    modelFn: model,
  });
  assert.ok(seenToolMessage !== null);
  const parsed = JSON.parse(seenToolMessage);
  assert.equal(parsed.found ?? true, true); // list_rooms returns an array; search returns found
});

test("loop stops at the step budget when the model never answers", async () => {
  const model: ModelFn = async () => ({
    content: "",
    toolCalls: [{ id: "c", name: "list_rooms", arguments: "{}" }],
  });
  const res = await runAgentLoop({
    system: "s",
    history: [{ role: "guest", content: "rooms?" }],
    tools: getToolsForSurface("guest"),
    ctx: GUEST_CTX,
    modelFn: model,
    maxSteps: 3,
  });
  assert.equal(res.reply, "");
  assert.match(res.error ?? "", /step budget/i);
  assert.equal(res.steps, 3);
});

// ---------------------------------------------------------------------------
// 4. Full guest turn with zero providers (deterministic core)
// ---------------------------------------------------------------------------

test("guest turn: price question is refused deterministically, no LLM", async () => {
  const res = await runGuestTurn({
    messages: [{ role: "guest", content: "How much is the deluxe suite per night?" }],
    sessionId: "t-price",
  });
  assert.equal(res.brain, "deterministic");
  assert.equal(res.reply, APPROVED_RATE_RESPONSE);
  assert.equal(scanForMoney(res.reply).hasMoney, false);
});

test("guest turn: known topic answered from static knowledge", async () => {
  const res = await runGuestTurn({
    messages: [{ role: "guest", content: "Is breakfast available and what styles?" }],
    sessionId: "t-known",
  });
  assert.equal(res.brain, "deterministic");
  assert.match(res.reply, /breakfast/i);
});

test("guest turn: contact fallback for unknowable questions", async () => {
  const res = await runGuestTurn({
    messages: [{ role: "guest", content: "What is the airspeed velocity of an unladen swallow?" }],
    sessionId: "t-unknown",
  });
  assert.equal(res.brain, "fallback");
  assert.match(res.reply, /hello@baiapalawan\.com/);
});

// ---------------------------------------------------------------------------
// 5. Admin turn gating
// ---------------------------------------------------------------------------

test("admin turn: refuses without the admin passkey", async () => {
  const res = await runAdminTurn({
    message: "show me bookings",
    sessionId: "t-admin",
    passkey: "not-the-passkey",
  });
  assert.equal(res.brain, "error");
  assert.equal(res.error, "invalid_passkey");
  assert.match(res.reply, /passkey/i);
});
