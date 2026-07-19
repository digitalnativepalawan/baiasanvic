/**
 * Local BAIA concierge acceptance test — uses the REAL concierge Onyx client
 * (src/baia/onyx/client.server.ts), same code path the live widget uses.
 * Key is injected from .onyx_key.tmp at runtime; .env is NOT edited.
 * No secrets printed.
 */
import { readFileSync } from "node:fs";

// --- inject proven-good key from memory file (do NOT touch .env) ---
const secret = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8")
  .match(/API_KEY_SECRET=(.*)/)?.[1]?.trim();
if (!secret) { console.error("KEY_MISSING"); process.exit(2); }
process.env.ONYX_API_KEY = secret;
process.env.ONYX_BASE_URL = process.env.ONYX_BASE_URL || "http://localhost:8080";
process.env.ONYX_RESORT_PERSONA_ID = process.env.ONYX_RESORT_PERSONA_ID || "1";

const { createOnyxResortAgentClient } = await import("../src/baia/onyx/client.server.ts");
const onyx = createOnyxResortAgentClient();

const conversationId = "accept-" + Date.now();
const messageId = "m-" + Date.now();
const msg = "Hi, I'd like to book a stay at BAIA. Name: Accept Proof. Email: accept-proof@example.invalid. Two guests, July 25 to 28.";

const res = await onyx.sendGuestEvent({
  resortId: "baia-san-vicente",
  conversationId,
  messageId,
  channel: "website",
  message: msg,
});

console.log("AUTH_OK", !res.error || res.error === "");
console.log("REPLY", (res.reply || "").slice(0, 200));
console.log("INTENT", res.intent);
console.log("SESSION", res.sessionId || res.onyxSessionId || "n/a");

const leadAction = (res.actions || []).find((a) => a.name === "create_guest_lead");
console.log("TOOL_FIRED", !!leadAction);
console.log("LEAD_RAW", JSON.stringify(leadAction).slice(0, 400));
console.log("LEAD_OK", leadAction?.ok === true || (leadAction && (leadAction as any).status === "success"));
console.log("LEAD_ID", leadAction?.lead_id || (leadAction as any)?.id || leadAction?.leadId || "n/a");
console.log("IDEM_KEY", leadAction?.idempotency_key || (leadAction as any)?.idempotency_key || leadAction?.idempotencyKey || "n/a");

const reply = (res.reply || "").toLowerCase();
const priceHit = /₱|php|usd|\$\s*\d|\d+\s*(peso|php)|price|rate is|costs|p\d|per night/i.test(reply);
console.log("NO_PRICE", !priceHit);

process.exit(0);
