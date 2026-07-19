// Clear Vite/Nitro SSR cache so the dev server recompiles server functions fresh.
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const dirs = [
  join(root, "node_modules", ".vite"),
  join(root, ".vinxi"),
  join(root, ".output"),
  join(root, "node_modules", ".cache"),
];
for (const d of dirs) {
  if (existsSync(d)) { rmSync(d, { recursive: true, force: true }); console.log("removed", d); }
  else console.log("absent", d);
}
console.log("cache clear done");
