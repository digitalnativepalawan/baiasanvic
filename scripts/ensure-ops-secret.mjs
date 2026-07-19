/**
 * Ensure ONYX_OPERATIONS_API_SECRET exists in local .env.
 * Generates a strong 32-byte hex secret if absent and appends it (quoted).
 * Prints ONLY status — never the secret value.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", ".env");

let text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const has = /^ONYX_OPERATIONS_API_SECRET=/m.test(text);
if (has) {
  console.log("ONYX_OPERATIONS_API_SECRET: already present (len masked)");
  process.exit(0);
}
const secret = randomBytes(32).toString("hex");
// Append with surrounding quotes to match existing .env style.
text = text.replace(/\n+$/, "") + `\nONYX_OPERATIONS_API_SECRET="${secret}"\n`;
writeFileSync(envPath, text);
console.log("ONYX_OPERATIONS_API_SECRET: generated (len=64), written to .env");
