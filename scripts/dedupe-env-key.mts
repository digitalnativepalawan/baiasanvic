/**
 * Dedupe ONYX_API_KEY in .env to exactly one correct line from .onyx_key.tmp.
 * No secrets printed. Verifies a real create-chat-session with the result.
 */
import { readFileSync, writeFileSync } from "node:fs";

const secret = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8")
  .match(/API_KEY_SECRET=(.*)/)?.[1]?.trim();
if (!secret) { console.error("source key missing"); process.exit(2); }

let env = readFileSync("C:/Users/david/baiasanvic/.env", "utf8");
// Remove all existing ONYX_API_KEY lines, then append one correct line.
const kept = env
  .split(/\r?\n/)
  .filter((l) => !/^ONYX_API_KEY=/.test(l));
const newEnv = kept.join("\n").replace(/\n*$/, "\n") + "ONYX_API_KEY=*** " + secret + "\n";
writeFileSync("C:/Users/david/baiasanvic/.env", newEnv);

const count = (readFileSync("C:/Users/david/baiasanvic/.env", "utf8").match(/^ONYX_API_KEY=/gm) || []).length;
console.log("REMAINING_ONYX_API_KEY_LINES", count);

const k = readFileSync("C:/Users/david/baiasanvic/.env", "utf8").match(/ONYX_API_KEY=(.*)/)?.[1]?.trim() as string;
console.log("ENV_KEY_MATCHES_SOURCE", k.slice(6) === secret, "LEN", k.length);

const r = await fetch("http://localhost:8080/chat/create-chat-session", {
  method: "POST",
  headers: { authorization: `Bearer ${k}`, "content-type": "application/json" },
  body: JSON.stringify({ persona_id: 1 }),
});
console.log("SESSION_STATUS", r.status, JSON.stringify(await r.json().catch(() => null)).slice(0, 100));
