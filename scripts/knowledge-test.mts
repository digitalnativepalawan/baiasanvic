/**
 * Run the BAIA knowledge test suite through the real Onyx persona 1.
 * No secrets printed. Reports per-test PASS/FAIL on the key checks.
 */
import { readFileSync } from "node:fs";

const secret = readFileSync("C:/Users/david/baiasanvic/.onyx_key.tmp", "utf8").match(/API_KEY_SECRET=(.*)/)?.[1]?.trim();
if (!secret) { console.error("KEY_MISSING"); process.exit(2); }
process.env.ONYX_API_KEY = secret;
process.env.ONYX_BASE_URL = process.env.ONYX_BASE_URL || "http://localhost:8080";
process.env.ONYX_RESORT_PERSONA_ID = process.env.ONYX_RESORT_PERSONA_ID || "1";

const { createOnyxResortAgentClient } = await import("../src/baia/onyx/client.server.ts");
const onyx = createOnyxResortAgentClient();

async function ask(conv: string, msg: string) {
  const r = await onyx.sendGuestEvent({ resortId: "baia-san-vicente", conversationId: conv, messageId: "m-" + Math.random().toString(36).slice(2,7), channel: "website", message: msg });
  return r.reply || "";
}

const tests: [string, string, (a: string) => boolean][] = [
  ["Q1 location", "Where exactly is BAIA?", (a) => /San Vicente|Palawan|Panindigan|Poblacion/i.test(a) && !/Port Barton/i.test(a.split(/Port Barton|port barton/i)[0] || "")],
  ["Q2 price refusal", "How much is a room and is direct booking cheaper?", (a) => !/[₱$]\s*\d|\d+\s*php|per night|rate is|php\s*\d/i.test(a) && /Booking\.com|Agoda|Airbnb|contact/i.test(a) && !/always cheaper|cheaper.*always/i.test(a)],
  ["Q3 wifi caution", "Can I work remotely from BAIA with guaranteed fast Wi-Fi?", (a) => !/guaranteed|fast wi-?fi|reliable wi-?fi/i.test(a) || /cannot guarantee|can'?t guarantee|not guaranteed|may not/i.test(a)],
  ["Q4 menu tonight", "What food is available tonight?", (a) => /menu|dish|restaurant|food/i.test(a) && !/[₱$]\s*\d|\d+\s*php/i.test(a)],
  ["Q5 menu price refusal", "How much is the shrimp pad thai?", (a) => !/[₱$]\s*\d|\d+\s*php|price is|costs/i.test(a) && /contact|menu|available/i.test(a)],
  ["Q6 tiramisu avail", "Is tiramisu available right now?", (a) => !/yes,?.*available|definitely|certainly/i.test(a) || /live.?check|confirm|may not|not guaranteed|staff/i.test(a)],
  ["Q7 walk port barton", "I’m at BAIA. Can I walk to dinner in Port Barton?", (a) => /separate|not.*walk|distance|port barton.*(separate|different|away)|can'?t walk|far/i.test(a) || /Port Barton.*(not|separate|different)/i.test(a)],
  ["Q8 tour A", "What is included in Port Barton Tour A?", (a) => !/standard|fixed|includes exactly/i.test(a) && /confirm|varies|check|staff|may differ|not standardized/i.test(a)],
];

let pass = 0, fail = 0;
for (const [name, q, fn] of tests) {
  const a = await ask("conv-" + name.replace(/\W/g, ""), q);
  const ok = fn(a);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  console.log("   A: " + a.slice(0, 160).replace(/\n/g, " "));
  ok ? pass++ : fail++;
}

console.log(`\nKNOWLEDGE_TESTS pass=${pass} fail=${fail}`);

// --- lead creation + duplicate ---
const conv = "leadconv-" + Date.now();
const leadInfo = (r: any) => { const x = (r.actions || []).find((a: any) => a.name === "create_guest_lead"); if (!x) return null; const raw = x.evidence?.value ? JSON.parse(x.evidence.value) : null; return raw?.tool_result ? { ok: raw.tool_result.ok, id: raw.tool_result.id, dup: raw.tool_result.duplicate ?? false } : null; };

const msg = "I want to book BAIA. Name: Test Guest. Email: test-guest@example.invalid. Phone: +639171234567. Arrival 2026-08-10, departure 2026-08-14, 2 adults, 0 children. Please confirm.";
const r1 = await onyx.sendGuestEvent({ resortId: "baia-san-vicente", conversationId: conv, messageId: "m1", channel: "website", message: msg });
const l1 = leadInfo(r1);
console.log("LEAD1", JSON.stringify(l1));
const r2 = await onyx.sendGuestEvent({ resortId: "baia-san-vicente", conversationId: conv, messageId: "m2", channel: "website", message: msg });
const l2 = leadInfo(r2);
console.log("LEAD2", JSON.stringify(l2));
console.log("LEAD_CREATED", !!l1 && l1.ok === true);
console.log("NO_DUP", !!l2 && l2.ok === true && l2.dup === true && l2.id === l1.id);
console.log("LEAD_IDS", l1?.id, l2?.id);
