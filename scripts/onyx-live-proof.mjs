/**
 * Controlled LIVE proof against the published BAIA endpoint.
 * Reads ONYX_OPERATIONS_API_SECRET from local env (never printed).
 * Does NOT use a service-role key; DB existence is proven via idempotent
 * duplicate (server forces fields + dedupes on (resort_id, idempotency_key)).
 */
const ENDPOINT = "https://baiasanvic.lovable.app/api/ops/guest-lead";
const SECRET = process.env.ONYX_OPERATIONS_API_SECRET;
if (!SECRET) { console.error("ONYX_OPERATIONS_API_SECRET missing"); process.exit(2); }

const idem = `onyx-live-proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function call() {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({
      resort_id: "baia-san-vicente",
      idempotency_key: idem,
      channel: "onyx_agent",
      guest: { name: "Onyx Live Proof", email: "onyx-proof@example.invalid" },
      notes: "ONYX_LIVE_PROOF",
    }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* leave null */ }
  return { status: res.status, json };
}

const out = { endpoint: ENDPOINT, idempotency_key: idem };
const c1 = await call();
out.call1 = c1;
console.log("CALL1_STATUS", c1.status);
console.log("CALL1_BODY", JSON.stringify(c1.json));
if (c1.json && c1.json.ok) {
  const c2 = await call();
  out.call2 = c2;
  console.log("CALL2_STATUS", c2.status);
  console.log("CALL2_BODY", JSON.stringify(c2.json));
}
console.log("IDEM_KEY", idem);
