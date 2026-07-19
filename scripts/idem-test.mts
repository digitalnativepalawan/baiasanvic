/**
 * Idempotency fix test: same confirmed inquiry twice.
 * Call 1 must create a row; call 2 must return the SAME row with duplicate:true.
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

const conversationId = "idem-fresh-" + Date.now();
const message = "I want to book BAIA San Vicente. Name: Fresh Proof. Email: fresh-proof@example.invalid. 2 guests, July 25 to 28.";

function leadInfo(res: any) {
  const a = (res.actions || []).find((x: any) => x.name === "create_guest_lead");
  if (!a) return null;
  const raw = a.evidence?.value ? JSON.parse(a.evidence.value) : null;
  const tr = raw?.tool_result;
  return tr ? { ok: tr.ok, id: tr.id, reference: tr.reference, status: tr.status, duplicate: tr.duplicate ?? false } : null;
}

const r1 = await onyx.sendGuestEvent({ resortId: "baia-san-vicente", conversationId, messageId: "m1", channel: "website", message });
const l1 = leadInfo(r1);
console.log("CALL1", JSON.stringify(l1));

const r2 = await onyx.sendGuestEvent({ resortId: "baia-san-vicente", conversationId, messageId: "m2", channel: "website", message });
const l2 = leadInfo(r2);
console.log("CALL2", JSON.stringify(l2));

console.log("STABLE_KEY_PASS", !!l1 && !!l2 && l1.id === l2.id);
console.log("FIRST_CREATED", !!l1 && l1.ok === true);
console.log("RETRY_SAME", !!l2 && l2.ok === true && l2.duplicate === true && l2.id === l1.id);
console.log("ROW_ID", l1?.id, l2?.id);
