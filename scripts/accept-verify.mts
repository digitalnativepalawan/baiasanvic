/**
 * Idempotency re-verify: send the SAME conversation/message ids so Onyx reuses
 * the same idempotency_key. Expect the SAME lead reference back (duplicate).
 * No secrets printed.
 */
import { readFileSync } from "node:fs";

const secret = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8").match(/API_KEY_SECRET=(.*)/)?.[1]?.trim();
if (!secret) { console.error("KEY_MISSING"); process.exit(2); }
process.env.ONYX_API_KEY = secret;
process.env.ONYX_BASE_URL = process.env.ONYX_BASE_URL || "http://localhost:8080";
process.env.ONYX_RESORT_PERSONA_ID = process.env.ONYX_RESORT_PERSONA_ID || "1";

const { createOnyxResortAgentClient } = await import("../src/baia/onyx/client.server.ts");
const onyx = createOnyxResortAgentClient();

// Same conversation/message ids as the acceptance run → same idempotency_key
const conversationId = "accept-fixed-verify";
const messageId = "m-fixed-verify";

const res = await onyx.sendGuestEvent({
  resortId: "baia-san-vicente",
  conversationId,
  messageId,
  channel: "website",
  message: "Booking interest: Verify Proof, verify-proof@example.invalid, 2 guests July 25-28.",
});

const lead = (res.actions || []).find((a: any) => a.name === "create_guest_lead");
const raw = lead?.evidence?.value ? JSON.parse(lead.evidence.value) : null;
const tr = raw?.tool_result;
console.log("TOOL_FIRED", !!lead);
console.log("OK", tr?.ok, "REFERENCE", tr?.reference, "ID", tr?.id, "STATUS", tr?.status);
console.log("DUP_REFERENCE", tr?.reference); // should match BAIA-997941 if idempotent
