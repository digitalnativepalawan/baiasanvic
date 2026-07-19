/**
 * Fix the corrupted .env ONYX_API_KEY from the source-of-truth .onyx_key.tmp,
 * then verify a real create-chat-session works with the env-loaded key.
 * No secrets printed.
 */
import { readFileSync, writeFileSync } from "node:fs";

const secret = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8")
  .match(/API_KEY_SECRET=(.*)/)?.[1]?.trim();
if (!secret) { console.error("source key missing"); process.exit(2); }

let env = readFileSync("C:/Users/david/baiasanvic/.env", "utf8");
env = env.replace(/^ONYX_API_KEY=.*$/m, "ONYX_API_KEY=*** " + secret);
writeFileSync("C:/Users/david/baiasanvic/.env", env);

const k = readFileSync("C:/Users/david/baiasanvic/.env", "utf8").match(/ONYX_API_KEY=(.*)/)?.[1]?.trim() as string;
console.log("ENV_KEY_LEN", k.length, "MATCHES_SOURCE", k.slice(6) === secret);

const r = await fetch("http://localhost:8080/chat/create-chat-session", {
  method: "POST",
  headers: { authorization: `Bearer ${k}`, "content-type": "application/json" },
  body: JSON.stringify({ persona_id: 1 }),
});
console.log("SESSION_STATUS", r.status, "BODY", JSON.stringify(await r.json().catch(() => null)).slice(0, 120));
