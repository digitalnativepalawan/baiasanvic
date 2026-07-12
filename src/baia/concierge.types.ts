/**
 * Types for the BAIA AI Concierge.
 * The concierge answers guest questions from the resort's own knowledge and
 * captures booking intent. It never quotes prices — it points guests to the
 * Book Now / inquiry links instead.
 */

export type ConciergeProvider = "openrouter" | "ollama";

export interface ConciergeConfig {
  enabled: boolean;
  provider: ConciergeProvider;
  // OpenRouter (owner supplies their own key; MerQato never bills tokens)
  openrouterApiKey: string;
  openrouterModel: string;
  // Ollama (local model auto-discovered on the device running the server)
  ollamaBaseUrl: string;
  ollamaModel: string;
  // Persona + knowledge the owner can edit from the admin panel
  persona: string;
  customKnowledge: string;
}

export interface ConciergeMessage {
  role: "guest" | "agent";
  content: string;
}

export interface ConciergeRequest {
  messages: ConciergeMessage[];
  sessionId: string;
}

export interface ConciergeResponse {
  reply: string;
  // True when no provider is configured / disabled — UI shows a friendly note.
  unavailable?: boolean;
}

// What the admin panel fetches to populate the model dropdowns (client-side).
export interface ModelCatalog {
  openrouter: string[]; // model ids (free models flagged)
  ollama: string[]; // locally installed model names
}
