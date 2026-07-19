/**
 * Diagnose: read ONYX_API_KEY from .env (via load-env import), call
 * create-chat-session + send-chat-message, print raw statuses. No secrets.
 */
const k = (process.env.ONYX_API_KEY || "").trim();
console.log("KEY_PRESENT", !!k, "KEY_LEN", k.length, "PREFIX_OK", k.startsWith("*** "));

const base = "http://localhost:8080";
const cs = await fetch(base + "/chat/create-chat-session", {
  method: "POST",
  headers: { authorization: `Bearer ${k}`, "content-type": "application/json" },
  body: JSON.stringify({ persona_id: 1 }),
});
console.log("CREATE_SESSION_STATUS", cs.status, JSON.stringify(await cs.json().catch(() => null)).slice(0, 120));
