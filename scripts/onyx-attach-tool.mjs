/**
 * Attach create_guest_lead (tool id 12) to BAIA persona (id 1).
 * Reads current persona snapshot, echoes required fields back with tool_ids
 * set to include 12. Does NOT print any key/secret.
 */
import { readFileSync } from "node:fs";

const KEYFILE = process.env.ONYX_KEYFILE || "C:/Users/david/baiasanvic/.onyx_key.tmp";
const raw = readFileSync(KEYFILE, "utf8");
const ONYX_API_KEY = (raw.match(/API_KEY_SECRET=(.+)/) || [])[1].trim();
if (!ONYX_API_KEY) { console.error("ONYX_API_KEY not found"); process.exit(2); }

const BASE = "http://localhost:8080";
const auth = { authorization: `Bearer ${ONYX_API_KEY}`, "content-type": "application/json" };
const get = async (p) => {
  const r = await fetch(BASE + p, { headers: { authorization: auth.authorization, accept: "application/json" } });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const cur = await get("/persona/1");
console.log("GET_STATUS", cur.status);
const p = cur.body || {};
const existingTools = p.tool_ids || [];
const newTools = existingTools.includes(12) ? existingTools : [...existingTools, 12];
console.log("EXISTING_TOOLS", JSON.stringify(existingTools), "NEW_TOOLS", JSON.stringify(newTools));

const payload = {
  name: p.name,
  description: p.description || "",
  document_set_ids: p.document_set_ids || [],
  tool_ids: newTools,
  system_prompt: p.system_prompt || "",
  task_prompt: p.task_prompt || "",
  datetime_aware: p.datetime_aware ?? false,
};
// Optional passthroughs if present
if (p.default_model_configuration_id != null) payload.default_model_configuration_id = p.default_model_configuration_id;
if (Array.isArray(p.starter_messages)) payload.starter_messages = p.starter_messages;
if (Array.isArray(p.label_ids)) payload.label_ids = p.label_ids;
if (Array.isArray(p.hierarchy_node_ids)) payload.hierarchy_node_ids = p.hierarchy_node_ids;
if (Array.isArray(p.document_ids)) payload.document_ids = p.document_ids;

const r = await fetch(BASE + "/persona/1", {
  method: "PATCH",
  headers: auth,
  body: JSON.stringify(payload),
});
const body = await r.json().catch(() => null);
console.log("PATCH_STATUS", r.status);
console.log("PATCH_TOOL_IDS", JSON.stringify((body && body.tool_ids) || null));
console.log("PATCH_NAME", body && body.name);
