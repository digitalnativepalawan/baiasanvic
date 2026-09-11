/**
 * Registers the test loader (see test-loader.mjs) for plain-node TypeScript
 * tests: node --experimental-strip-types --import ./scripts/test-register.mjs
 */
import { register } from "node:module";

register("./test-loader.mjs", import.meta.url);
