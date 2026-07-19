/**
 * Load the five BAIA knowledge files into existing persona 1 (MerQato Resort Agent)
 * by setting its system_prompt. Preserves name, description, tools, tool_ids.
 * No secret printed. Reads prompt from local temp file.
 */
import { readFileSync } from "node:fs";

const onyxKey = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8").match(/API_KEY_SECRET=(.+)/)?.[1]?.trim() as string;
const H = { authorization: `Bearer ${onyxKey}`, "content-type": "application/json" };
const BASE = "http://localhost:8080";

const get = async (p: string) => {
  const r = await fetch(BASE + p, { headers: { authorization: H.authorization } });
  return { s: r.status, b: await r.json().catch(() => null) };
};
const patch = async (p: string, body: any) => {
  const r = await fetch(BASE + p, { method: "PATCH", headers: H, body: JSON.stringify(body) });
  return { s: r.status, b: await r.json().catch(() => null) };
};

// current persona
const cur = await get("/persona/1");
const p: any = cur.b;
console.log("CURRENT name:", p.name, "tools:", JSON.stringify((p.tools || []).map((t: any) => t.name)));

const prompt = readFileSync("C:/Users/david/AppData/Local/Temp/baia_kp/persona_prompt.txt", "utf8");

// Build PersonaUpsertRequest preserving existing fields
const body: any = {
  name: p.name,
  description: p.description ?? "",
  document_set_ids: p.document_set_ids ?? [],
  is_public: p.is_public ?? false,
  tool_ids: (p.tools || []).map((t: any) => t.id).filter((id: any) => id != null),
  system_prompt: prompt,
  replace_base_system_prompt: true,
  task_prompt: p.task_prompt ?? "",
  datetime_aware: p.datetime_aware ?? true,
  user_file_ids: p.user_file_ids ?? [],
  hierarchy_node_ids: p.hierarchy_node_ids ?? [],
  document_ids: p.document_ids ?? [],
};

const res = await patch("/persona/1", body);
console.log("PATCH_STATUS", res.s);
if (res.s !== 200) { console.log("ERR", JSON.stringify(res.b).slice(0, 300)); process.exit(1); }
console.log("NEW system_prompt_len", (res.b?.system_prompt || "").length);
console.log("STILL_HAS_TOOL", (res.b?.tools || []).some((t: any) => t.name === "create_guest_lead"));
console.log("NO_PRICE_FIRST", (res.b?.system_prompt || "").slice(0, 40));
