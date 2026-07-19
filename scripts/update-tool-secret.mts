/**
 * Update local Onyx tool 12 custom header `authorization` to the new secret.
 * Reads new secret from ONYX_OPERATIONS_API_SECRET.txt. No secret printed.
 */
import { readFileSync } from "node:fs";

const secret = readFileSync("C:/Users/david/baiasanvic/ONYX_OPERATIONS_API_SECRET.txt", "utf8").trim();
const onyxKey = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8").match(/API_KEY_SECRET=(.+)/)?.[1]?.trim() as string;

const H = { authorization: `Bearer ${onyxKey}`, "content-type": "application/json" };
const get = async (p: string) => {
  const r = await fetch("http://localhost:8080" + p, { headers: { authorization: H.authorization } });
  return r.json();
};
const put = async (p: string, body: any) => {
  const r = await fetch("http://localhost:8080" + p, { method: "PUT", headers: H, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const t: any = await get("/tool/12");
const headers = (t.custom_headers || []).map((h: any) =>
  h.key.toLowerCase() === "authorization" ? { ...h, value: `Bearer ${secret}` } : h
);

const res = await put("/admin/tool/custom/12", {
  name: t.name,
  description: t.description,
  definition: t.definition,
  custom_headers: headers,
  passthrough_auth: t.passthrough_auth ?? false,
});
console.log("PUT_STATUS", res.status);

// verify the header value length (not content) on the tool
const after: any = await get("/tool/12");
const ah = (after.custom_headers || []).find((h: any) => h.key.toLowerCase() === "authorization");
console.log("HEADER_VALUE_LEN", ah ? ah.value.length : 0, "MATCHES_NEW", ah ? ah.value === secret : false);
