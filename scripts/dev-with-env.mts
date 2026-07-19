// Start the BAIA vite dev server with .env ONYX_* vars injected into its env.
// Reads .env directly (no shell export of secrets). No secret printed.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const envText = readFileSync(".env", "utf8");
const env: Record<string, string> = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*?)"?\s*$/);
  if (m) env[m[1]] = m[2];
}
const childEnv = { ...process.env, ...env };
const npmDir = "C:/Users/david/AppData/Local/hermes/node";
childEnv.PATH = `${npmDir}${process.env.PATH ? ":" + process.env.PATH : ""}`;

const child = spawn("C:/Users/david/AppData/Local/hermes/node/npm", ["run", "dev"], { env: childEnv, cwd: process.cwd(), stdio: "inherit", shell: true });
child.on("exit", (c) => process.exit(c ?? 0));
