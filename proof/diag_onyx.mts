/**
 * Diagnostic: confirm the chat session is created with persona_id=1 and that
 * the persona's tools/system prompt are applied. Uses BAIA's real client config.
 */
import { createOnyxResortAgentClient } from "../src/baia/onyx/client.server.ts";

const onyx = createOnyxResortAgentClient();

// Strong booking intent
const message =
  "I want to book a room. My name is Test Guest, email test.guest@example.com, arriving Aug 10 leaving Aug 15, 2 adults. Please save my details.";

const res = await onyx.sendGuestEvent({ message, personaId: 1, onyxSessionId: undefined });
console.log("SESSION:", res.onyxSessionId);
console.log("REPLY:", res.reply);
console.log("INTENT:", res.intent);
console.log("ACTIONS:", JSON.stringify(res.actions));
console.log("ERROR:", res.error ?? null);
