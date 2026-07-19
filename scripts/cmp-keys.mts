/**
 * Compare source secret (.tmp) vs .env secret, and test BOTH against Onyx.
 * No secrets printed.
 */
import { readFileSync } from "node:fs";

const raw = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8");
const src = raw.match(/API_KEY_SECRET=(.*)/)?.[1]?.trim() as string;
const envLine = readFileSync("C:/Users/david/baiasanvic/.env", "utf8").match(/ONYX_API_KEY=(.*)/)?.[1]?.trim() as string;
const envVal = envLine.startsWith("*** ") ? envLine.slice(6) : envLine;

console.log("SRC_LEN", src.length, "ENV_VAL_LEN", envVal.length, "EQUAL", src === envVal);
console.log("SRC_TAIL", JSON.stringify(src.slice(-8)), "ENV_TAIL", JSON.stringify(envVal.slice(-8)));

async function test(label: string, key: string) {
  const r = await fetch("http://localhost:8080/chat/create-chat-session", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ persona_id: 1 }),
  });
  console.log(label, "STATUS", r.status);
}

await test("SRC", src);
await test("ENV", envVal);
