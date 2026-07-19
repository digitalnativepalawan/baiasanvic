/**
 * Write .env ONYX_API_KEY byte-exactly from .onyx_key.tmp, assert length, test.
 * No secrets printed.
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8")
  .match(/API_KEY_SECRET=(.*)/)?.[1]?.trim() as string;
console.log("SRC_LEN", src.length);

let env = readFileSync("C:/Users/david/baiasanvic/.env", "utf8");
const lines = env.split(/\r?\n/).filter((l) => !/^ONYX_API_KEY=/.test(l));
const newValue = "*** " + src;
lines.push("ONYX_API_KEY=" + newValue);
const newEnv = lines.join("\r\n") + "\r\n";
writeFileSync("C:/Users/david/baiasanvic/.env", newEnv);

const readBack = readFileSync("C:/Users/david/baiasanvic/.env", "utf8");
const envVal = readBack.match(/ONYX_API_KEY=(.*)/)?.[1]?.trim() as string;
const val = envVal.startsWith("*** ") ? envVal.slice(6) : envVal;
console.log("WRITTEN_VAL_LEN", val.length, "MATCHES_SRC", val === src);

const r = await fetch("http://localhost:8080/chat/create-chat-session", {
  method: "POST",
  headers: { authorization: `Bearer ${val}`, "content-type": "application/json" },
  body: JSON.stringify({ persona_id: 1 }),
});
console.log("SESSION_STATUS", r.status);
