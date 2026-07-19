/**
 * Persistence repository interfaces. The Resort Agent core depends ONLY on
 * these interfaces — never on Supabase directly. Swap the implementation
 * (memory vs supabase) via configuration; business logic is untouched.
 *
 * All writes are server-side only. The browser never imports these.
 */
import type { AgentAction, AgentIntent, GuestExtractedDetails } from "../types.ts";

export interface ConversationRecord {
  id: string;
  resortId: string;
  channel: string;
  externalSessionId: string;
  guestName?: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  resortId: string;
  role: "guest" | "agent";
  content: string;
  msgExternalId: string;
  createdAt: string;
}

export interface LeadRecord {
  id: string;
  resortId: string;
  conversationId?: string;
  channel: string;
  guestName?: string;
  email?: string;
  phone?: string;
  checkIn?: string;
  checkOut?: string;
  guestCount?: number;
  childrenCount?: number;
  roomPreference?: string;
  transportNeeded?: boolean;
  status: string;
  createdAt: string;
}

export interface RateRequestRecord {
  id: string;
  leadId?: string;
  resortId: string;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  roomPreference?: string;
  transportNeeded?: boolean;
  contactDetails?: string;
  status: string;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  resortId: string;
  leadId?: string;
  conversationId?: string;
  actionType: string;
  draftContent: string;
  riskLevel: string;
  status: string;
  createdAt: string;
}

export interface ActivityRecord {
  id: string;
  resortId: string;
  actor: string;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  createdAt: string;
}

export interface ConversationRepository {
  upsertConversation(c: Omit<ConversationRecord, "id" | "createdAt">): Promise<ConversationRecord>;
  appendMessage(m: Omit<MessageRecord, "id" | "createdAt">): Promise<MessageRecord>;
  getByExternalSession(resortId: string, externalSessionId: string): Promise<ConversationRecord | null>;
}

export interface LeadRepository {
  createOrUpdateByConversation(
    resortId: string,
    conversationId: string,
    data: Partial<LeadRecord>,
  ): Promise<LeadRecord>;
}

export interface RateRequestRepository {
  create(data: Omit<RateRequestRecord, "id" | "createdAt" | "status"> & { status?: string }): Promise<RateRequestRecord>;
  get?(id: string): Promise<RateRequestRecord | null>;
}

export interface ApprovalRepository {
  create(data: Omit<ApprovalRecord, "id" | "createdAt" | "status"> & { status?: string }): Promise<ApprovalRecord>;
  get?(id: string): Promise<ApprovalRecord | null>;
  update?(id: string, patch: Partial<ApprovalRecord>): Promise<ApprovalRecord>;
}

export interface FollowUpRepository {
  create(resortId: string, leadId: string, dueAt?: string): Promise<{ id: string }>;
}

export interface ActivityRepository {
  log(data: Omit<ActivityRecord, "id" | "createdAt">): Promise<ActivityRecord>;
}

export interface ResortAgentRepositories {
  conversations: ConversationRepository;
  leads: LeadRepository;
  rateRequests: RateRequestRepository;
  approvals: ApprovalRepository;
  followUps: FollowUpRepository;
  activity: ActivityRepository;
}
