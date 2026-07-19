/**
 * Real Onyx-originated lead: create chat session (persona 1), send a message
 * that should invoke create_guest_lead, observe the tool call. No secrets printed.
 */
import { readFileSync } from "node:fs";

const KEYFILE = process.env.ONYX_KEYFILE || "C:/Users/david/baiasanvic/.onyx_key.tmp";
const ONYX_API_KEY = (readFileSync(KEYFILE, "utf8").match(/API_KEY_SECRET=(.+)/) || [])[1].trim();
if (!ONYX_API_KEY) { console.error("ONYX_API_KEY missing"); process.exit(2); }

const BASE = "http://localhost:8080";
const H = { authorization: `Bearer ${ONYX_API_KEY}`, "content-type": "application/json" };
const send = async (path, body) => {
  const r = await fetch(BASE + path, { method: "POST", headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, body: j };
};

const idem = `onyx-runtime-proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const msg = `Please create a guest lead for me. Name: Onyx Runtime Proof. Email: onyx-proof@example.invalid. Note this is the ONYX_RUNTIME_PROOF. Use idempotency key ${idem}.`;

// 1. create session with BAIA persona
const cs = await send("/chat/create-chat-session", { persona_id: 1 });
console.log("CREATE_SESSION_STATUS", cs.status);
const sessionId = cs.body && cs.body.chat_session_id;
console.log("SESSION_ID", sessionId);

// 2. send message
const sm = await send("/chat/send-chat-message", {
  chat_session_id: sessionId,
  message: msg,
  stream: false,
});
console.log("SEND_STATUS", sm.status);
const toolCalls = (sm.body && sm.body.tool_calls) || [];
console.log("TOOL_CALLS", JSON.stringify(toolCalls.map((t) => ({ name: t.tool_name, ok: t.tool_result && t.tool_result.ok, lead_id: t.tool_result && t.tool_result.lead_id, idem: t.tool_result && t.tool_result.idempotency_key }))));
console.log("ANSWER", (sm.body && sm.body.answer || "").slice(0, 200));
console.log("IDEM_KEY", idem);
