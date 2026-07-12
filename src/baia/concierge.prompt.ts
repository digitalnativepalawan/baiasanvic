/**
 * Builds the system prompt for the concierge with hard guardrails:
 *  - NEVER quote prices or rates.
 *  - Always steer guests to the Book Now button / inquiry form.
 *  - Only use provided knowledge; if unsure, invite an inquiry.
 * The knowledge block is injected dynamically by the caller (retrieval).
 */
import type { ConciergeConfig } from "./concierge.types";

export function buildSystemPrompt(cfg: ConciergeConfig, knowledgeBlock: string): string {
  return [
    cfg.persona.trim(),
    "",
    "==============================",
    "HARD RULES (never break these):",
    "1. NEVER state or guess prices, nightly rates, or total costs. The resort confirms all rates by email after an inquiry.",
    "2. When a guest asks about price/cost/rate, do NOT give a number. Instead say rates are confirmed on inquiry and point them to the 'Book Your Stay' button or the inquiry form.",
    "3. Keep replies concise (2-4 sentences) and warm. Offer to take their booking details (name, email, dates, guests, room type) so they can submit an inquiry.",
    "4. Only use the KNOWLEDGE below. If you don't know something, say the resort will confirm by email — never invent facts.",
    "5. You are a concierge, not a booking system. You cannot take payment or guarantee availability.",
    "==============================",
    "",
    "KNOWLEDGE:",
    knowledgeBlock,
    "",
    "End of knowledge. Answer the guest now using only the above.",
  ].join("\n");
}
