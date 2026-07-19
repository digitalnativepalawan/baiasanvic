/**
 * Faithful guest-path proof (after adapter fix): same Onyx client the concierge
 * uses. Prints normalized action status + lead_id. No secrets printed.
 * ONYX_* env via masked loader (--import ./scripts/load-env.ts).
 */
import { createOnyxResortAgentClient } from "../src/baia/onyx/client.server.ts";

const idem = `frontdoor-proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const msg = `Hi, I'd like to ask about staying at BAIA. Name: Front Door Proof. Email: frontdoor-proof@example.invalid. Please use idempotency key ${idem}.`;

const onyx = createOnyxResortAgentClient();
const res = await onyx.sendGuestEvent({
  resortId: "baia-san-vicente",
  conversationId: "frontdoor-session-" + Date.now(),
  messageId: "m_" + Date.now(),
  channel: "website",
  message: msg,
});
console.log("REPLY", (res.reply || "").slice(0, 200));
console.log("INTENT", res.intent);
console.log("ACTIONS", JSON.stringify(res.actions.map((a) => ({
  name: a.name,
  status: a.status,
  ok: a.evidence && (a.evidence as any).ok,
  lead_id: a.evidence && (a.evidence as any).lead_id,
  idem: a.evidence && (a.evidence as any).idempotency_key,
  resort_id: a.evidence && (a.evidence as any).resort_id,
  created: a.evidence && (a.evidence as any).created,
}))));
console.log("ONYX_SESSION", res.onyxSessionId);
console.log("IDEM_KEY", idem);
