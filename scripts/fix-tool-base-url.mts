/**
 * Fix Onyx tool 12 servers.url: base host only (path lives in the spec path).
 * No secret printed.
 */
import { readFileSync } from "node:fs";

const onyxKey = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8").match(/API_KEY_SECRET=(.+)/)?.[1]?.trim() as string;
const H = { authorization: `Bearer ${onyxKey}`, "content-type": "application/json" };
const get = async (p: string) => (await fetch("http://localhost:8080" + p, { headers: { authorization: H.authorization } })).json();
const put = async (p: string, body: any) => {
  const r = await fetch("http://localhost:8080" + p, { method: "PUT", headers: H, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const t: any = await get("/tool/12");
const def = JSON.parse(JSON.stringify(t.definition || {}));
def.servers = [{ url: "https://baiasanvic.lovable.app" }];

const res = await put("/admin/tool/custom/12", {
  name: t.name,
  description: t.description,
  definition: def,
  custom_headers: t.custom_headers || [],
  passthrough_auth: t.passthrough_auth ?? false,
});
console.log("PUT_STATUS", res.status);

const after: any = await get("/tool/12");
console.log("SERVERS_URL", JSON.stringify(after.definition?.servers));
console.log("PATHS", JSON.stringify(Object.keys(after.definition?.paths || {})));
