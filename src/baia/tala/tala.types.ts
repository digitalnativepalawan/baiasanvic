/**
 * Types for TALA Agent integration.
 * TALA is the Hermes-powered backend that handles complex guest queries,
 * voice interactions, and resort operations.
 */

export interface TalaConfig {
  apiUrl: string;
  enabled: boolean;
}

export interface TalaMessage {
  role: "guest" | "agent";
  content: string;
  timestamp?: string;
}

export interface TalaChatRequest {
  message: string;
  sessionId: string;
  context?: Record<string, unknown>;
}

export interface TalaChatResponse {
  reply: string;
  brain: string;
  actions: Array<{ name: string; status: string }>;
}

export interface TalaVoiceResponse {
  transcription: string;
  reply: string;
  audioBase64: string;
}

export interface TalaStatus {
  status: string;
  skills: string[];
  providers: {
    ollama: boolean;
    openrouter: boolean;
  };
}

export interface TalaTool {
  name: string;
  description?: string;
}
