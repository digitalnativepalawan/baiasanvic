/**
 * Resolution hook for running the app's TypeScript modules under plain
 * `node --experimental-strip-types --test`.
 *
 * The app is bundled by Vite, which allows two import styles plain Node
 * can't resolve on its own:
 *   1. Extensionless relative imports  → "./data" means "./data.ts"
 *   2. The "@" path alias (tsconfig)   → "@/baia/x" means "<root>/src/baia/x"
 *
 * This hook adds both, without changing any application code. It only ever
 * resolves files inside this repo (relative or aliased specifiers); bare
 * package specifiers pass straight through to Node.
 */
import { pathToFileURL, fileURLToPath } from "node:url";

const REPO_ROOT = new URL("../", import.meta.url);

export async function resolve(specifier, context, next) {
  // 2) Map the "@/x" alias onto <root>/src/x — same as tsconfig paths.
  if (specifier.startsWith("@/")) {
    const abs = new URL("./src/" + specifier.slice(2), REPO_ROOT);
    specifier = pathToFileURL(fileURLToPath(abs)).href;
  }

  try {
    return await next(specifier, context);
  } catch (err) {
    // 1) Retry extensionless relative/file imports with an explicit ".ts".
    const isRelative = specifier.startsWith(".");
    const isFileUrl = specifier.startsWith("file:");
    if (isRelative || isFileUrl) {
      try {
        return await next(specifier + ".ts", context);
      } catch {
        // Directory imports: try "<dir>/index.ts".
        try {
          return await next(specifier.replace(/\/+$/, "") + "/index.ts", context);
        } catch {
          // fall through to original error
        }
      }
    }
    throw err;
  }
}
