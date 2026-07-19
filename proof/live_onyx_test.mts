/**
 * BAIA-side live test harness. Imports the REAL OnyxResortAgentClient that
 * concierge.server.ts uses, and sends the guest message through it.
 * Exercises the exact BAIA -> Onyx path (no mock, no manual tool call).
 * Run with: node --experimental-strip-types proof/live_onyx_test.mts
 */
import { createOnyxResortAgentClient } from "../src/baia/onyx/client.server.ts";

const onyx = createOnyxResortAgentClient();

const message =
  "Hello, my name is Test Guest. My email is test.guest@example.com. I am planning to stay in August and would like information about your rooms.";

const result = await onyx.sendGuestEvent({
  message,
  personaId: 1,
  onyxSessionId: undefined,
});

console.log("=== LIVE ONYX RESULT ===");
console.log(JSON.stringify(result, null, 2));
