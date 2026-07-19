/**
 * Minimal .env loader for node --import (test runner only).
 * Deliberately does NOT print any variable values.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", ".env");

try {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip surrounding single/double quotes so quotes aren't kept in the value.
    val = val.replace(/^['"]|['"]$/g, "");
    if (key && !(key in process.env) && val) process.env[key] = val;
  }
} catch {
  // .env missing: tests will throw a clear "must be set" error (no secret printed)
}
