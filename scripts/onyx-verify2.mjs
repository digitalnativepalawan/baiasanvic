/**
 * Onyx verification step 2: inspect persona detail + tool list.
 * Loads ONYX_API_KEY from a file (path via ONYX_KEYFILE, default repo .onyx_key.tmp).
 * Does NOT print any key/secret.
 */
import { readFileSync } from "node:fs";

const KEYFILE = process.env.ONYX_KEYFILE || "C:/Users/david/baiasanvic/.onyx_key.tmp";
const raw = readFileSync(KEYFILE, "utf8");
const m = raw.match(/API_KEY_SECRET=(.+)/);
const ONYX_API_KEY = m ? m[1].trim() : "";
if (!ONYX_API_KEY) { console.error("ONYX_API_KEY not found"); process.exit(2); }

const BASE = "http://localhost:8080";
const auth = { authorization: `Bearer ${ONYX_API_KEY}` };
const get = async (p) => {
  const r = await fetch(BASE + p, { headers: { ...auth, accept: "application/json" } });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const persona = await get("/persona/1");
console.log("PERSONA_DETAIL_STATUS", persona.status);
const pd = persona.body || {};
console.log("PERSONA_NAME", pd.name);
console.log("PERSONA_TOOL_IDS", JSON.stringify(pd.tool_ids || pd.prompt_tool_ids || []));
console.log("PERSONA_KEYWORDS", JSON.stringify(pd.keywords || null));

const tools = await get("/tool");
console.log("TOOL_LIST_STATUS", tools.status);
const tl = Array.isArray(tools.body) ? tools.body : (tools.body && tools.body.items ? tools.body.items : []);
console.log("TOOL_COUNT", tl.length);
const cgl = tl.filter((t) => /guest_lead|create_guest/i.test(JSON.stringify(t)));
console.log("CREATE_GUEST_LEAD_TOOL", JSON.stringify(cgl.map((t) => ({ id: t.id, name: t.name, tool_type: t.tool_type || t.type }))));
