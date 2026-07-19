/**
 * Fix tool 12 server_url in the live Onyx DB via the admin API.
 * Reads current tool 12, swaps servers[0].url, PATCHes back. No secrets printed.
 * ONYX_API_KEY from /c/Users/david/baiasanvic/.onyx_key.tmp
 */
import { readFileSync } from "node:fs";

const KEYFILE = "C:/Users/david/baiasanvic/.onyx_key.tmp";
const secret = readFileSync(KEYFILE, "utf8").match(/API_KEY_SECRET=(.+)/)?.[1]?.trim();
if (!secret) { console.error("key missing"); process.exit(2); }

const BASE = "http://localhost:8080";
const H = { authorization: `Bearer ${secret}`, "content-type": "application/json" };

const get = async (p) => {
  const r = await fetch(BASE + p, { headers: { authorization: H.authorization, accept: "application/json" } });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const patch = async (p, body) => {
  const r = await fetch(BASE + p, { method: "PUT", headers: H, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const cur = await get("/tool/12");
console.log("GET_STATUS", cur.status);
const t = cur.body || {};
const def = t.definition || {};
console.log("BEFORE_URL", def?.servers?.[0]?.url);

const newDef = JSON.parse(JSON.stringify(def));
if (!newDef.servers) newDef.servers = [{}];
newDef.servers[0] = { url: "https://baiasanvic.lovable.app/api/ops/guest-lead" };

const res = await patch("/admin/tool/custom/12", {
  name: t.name,
  description: t.description,
  definition: newDef,
  custom_headers: t.custom_headers || [],
  passthrough_auth: t.passthrough_auth ?? false,
});
console.log("PATCH_STATUS", res.status);

// re-read to prove
const after = await get("/admin/tool/12");
const afterDef = after.body?.definition || {};
console.log("AFTER_URL", afterDef?.servers?.[0]?.url);
console.log("MATCH", afterDef?.servers?.[0]?.url === "https://baiasanvic.lovable.app/api/ops/guest-lead");
