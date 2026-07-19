/**
 * Reusable Resort Agent core — shared types.
 *
 * BAIA-free: this module must never hard-code a resort name, location, room,
 * policy, contact, brand, booking link, or price. Resort-specific values live
 * in knowledge passed at runtime and in the BAIA integration layer.
 *
 * Source attribution: behavioral rules ported from
 *   /c/Users/david/Projects/onyx/backend/onyx/skills/builtin/resort-agent/
 * (Onyx Resort Agent skill, MIT). See SKILL.md / instructions/*.md there.
 */

export type AgentChannel =
  | "website"
  | "whatsapp"
  | "telegram"
  | "email"
  | "manual";

export type AgentIntent =
  | "general"
  | "booking_inquiry"
  | "availability"
  | "rate_request"
  | "guest_service"
  | "complaint"
  | "human_handoff";

export type ActionStatus = "draft" | "pending_approval" | "deferred";

export interface AgentAction {
  type: string;
  status: ActionStatus;
  /** Optional structured detail (e.g. lead id) for internal use. */
  ref?: string;
}

export interface GuestExtractedDetails {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  roomPreference?: string;
  transportNeeded?: boolean;
  specialOccasion?: string;
}

export interface AgentGuest {
  name?: string;
  email?: string;
  phone?: string;
}

export interface RunResortAgentInput {
  resortId: string;
  channel: AgentChannel;
  sessionId: string;
  messageId: string;
  message: string;
  guest?: AgentGuest;
  /** Optional prior extracted details (accumulated across the conversation). */
  priorDetails?: GuestExtractedDetails;
  /** Optional resort knowledge bag (non-monetary). If omitted, core uses only rules. */
  knowledge?: ResortKnowledgeBag;
}

export interface RunResortAgentResult {
  resortId: string;
  reply: string;
  intent: AgentIntent;
  approvalRequired: boolean;
  databaseWriteDeferred: boolean;
  extractedDetails?: GuestExtractedDetails;
  actions: AgentAction[];
}

/**
 * Non-monetary, AI-retrieval-eligible knowledge. Monetary fields are NEVER
 * included here (see knowledge/types). The core only reads descriptions and
 * policy text — never prices.
 */
export interface ResortKnowledgeBag {
  resortName?: string;
  rooms?: Array<{ name: string; description: string; maxOccupancy: number; features: string[]; beachfront?: boolean }>;
  policies?: Record<string, string>;
  transport?: Array<{ type: string; description: string }>;
  destination?: { attractions?: Array<{ name: string; description: string }> };
  faqs?: Array<{ question: string; answer: string }>;
}

/** The single reusable entry point the BAIA concierge (and future channels) call. */
export type RunResortAgent = (input: RunResortAgentInput) => Promise<RunResortAgentResult>;
