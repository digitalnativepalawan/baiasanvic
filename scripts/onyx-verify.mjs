/**
 * Onyx runtime verification driver.
 * Loads ONYX_API_KEY from /tmp/onyx_out.txt (container bootstrap output).
 * Does NOT print any key/secret.
 */
import { readFileSync } from "node:fs";

const KEYFILE = process.env.ONYX_KEYFILE || "/tmp/onyx_out.txt";
const raw = readFileSync(KEYFILE, "utf8");
const m = raw.match(/API_KEY_SECRET=(.+)/);
const ONYX_API_KEY = m ? m[1].trim() : "";
if (!ONYX_API_KEY) { console.error("ONYX_API_KEY not found in bootstrap output"); process.exit(2); }

const BASE = "http://localhost:8080";
const auth = { authorization: `Bearer ${ONYX_API_KEY}` };

async function jget(path) {
  const r = await fetch(BASE + path, { headers: { ...auth, accept: "application/json" } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

const p = await jget("/persona");
console.log("PERSONA_LIST_STATUS", p.status);
const list = Array.isArray(p.body) ? p.body : (p.body && p.body.items ? p.body.items : []);
console.log("PERSONA_COUNT", list.length);
const baias = list.filter((x) => /baia|resort|merqato|san vicente/i.test(JSON.stringify(x)));
console.log("BAIA_CANDIDATES", JSON.stringify(baias.map((x) => ({ id: x.id, name: x.name, tool_ids: x.tool_ids || x.prompt_tool_ids || null }))));
const found = baias[0] || list[0];
if (found) {
  console.log("TARGET_PERSONA_ID", found.id, "NAME", found.name);
  console.log("TARGET_TOOL_IDS", JSON.stringify(found.tool_ids || found.prompt_tool_ids || []));
}
