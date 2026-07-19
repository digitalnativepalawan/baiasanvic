/**
 * Append Onyx runtime env vars to local .env if absent.
 * Reads ONYX_API_KEY from the container-bootstrap output file (values withheld).
 * Does NOT print any secret.
 */
import { readFileSync, readFileSync as rf, existsSync, appendFileSync } from "node:fs";

const KEYFILE = "C:/Users/david/baiasanvic/.onyx_key.tmp";
const ENV = "C:/Users/david/baiasanvic/.env";

const secret = readFileSync(KEYFILE, "utf8").match(/API_KEY_SECRET=(.+)/)?.[1]?.trim();
if (!secret) { console.error("Onyx key not found"); process.exit(2); }

const additions = [
  `ONYX_BASE_URL=http://localhost:8080`,
  `ONYX_API_KEY=*** ${secret}`,
  `ONYX_RESORT_PERSONA_ID=1`,
  `ONYX_TIMEOUT_MS=30000`,
];

const existing = existsSync(ENV) ? readFileSync(ENV, "utf8") : "";
const lines = existing.split(/\r?\n/);
const have = new Set(lines.filter(Boolean).map((l) => l.split("=")[0]));
const toAdd = additions.filter((a) => !have.has(a.split("=")[0]));
if (toAdd.length) {
  appendFileSync(ENV, (existing.endsWith("\n") || !existing ? "" : "\n") + toAdd.join("\n") + "\n");
  console.log("ADDED", toAdd.map((a) => a.split("=")[0]).join(", "));
} else {
  console.log("ALREADY_PRESENT", additions.map((a) => a.split("=")[0]).join(", "));
}
