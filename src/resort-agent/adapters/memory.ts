/**
 * Development in-memory persistence adapter.
 *
 * Purpose (per governing spec):
 *  - Never pretends data is permanently saved.
 *  - Returns databaseWriteDeferred: true semantics to callers.
 *  - Allows the full agent workflow to be tested.
 *  - Supports deterministic fixtures and idempotency.
 *  - Requires no Supabase tables.
 *
 * This is NOT a database. State lives only for the process lifetime and is
 * explicitly marked non-durable. The Supabase adapter replaces it once the
 * owner confirms the SQL ran.
 */
import type {
  ActivityRecord,
  ActivityRepository,
  ApprovalRecord,
  ApprovalRepository,
  ConversationRecord,
  ConversationRepository,
  FollowUpRepository,
  LeadRecord,
  LeadRepository,
  MessageRecord,
  RateRequestRecord,
  RateRequestRepository,
  ResortAgentRepositories,
} from "./repositories.ts";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export class MemoryConversationRepository implements ConversationRepository {
  private conversations = new Map<string, ConversationRecord>();
  private byExternal = new Map<string, string>(); // resortId|externalSessionId -> id
  private messages = new Map<string, MessageRecord[]>(); // conversationId -> msgs
  private messageKeys = new Set<string>(); // conversationId|msgExternalId

  async upsertConversation(c: Omit<ConversationRecord, "id" | "createdAt">): Promise<ConversationRecord> {
    const key = `${c.resortId}|${c.externalSessionId}`;
    const existingId = this.byExternal.get(key);
    if (existingId) {
      const existing = this.conversations.get(existingId)!;
      const updated: ConversationRecord = {
        ...existing,
        guestName: c.guestName ?? existing.guestName,
        email: c.email ?? existing.email,
        phone: c.phone ?? existing.phone,
      };
      this.conversations.set(existingId, updated);
      return updated;
    }
    const rec: ConversationRecord = { ...c, id: uid("conv"), createdAt: new Date().toISOString() };
    this.conversations.set(rec.id, rec);
    this.byExternal.set(key, rec.id);
    this.messages.set(rec.id, []);
    return rec;
  }

  async appendMessage(m: Omit<MessageRecord, "id" | "createdAt">): Promise<MessageRecord> {
    // Idempotency: duplicate msgExternalId for the same conversation is a no-op.
    const dupKey = `${m.conversationId}|${m.msgExternalId}`;
    if (this.messageKeys.has(dupKey)) {
      const list = this.messages.get(m.conversationId) ?? [];
      return list.find((x) => x.msgExternalId === m.msgExternalId)!;
    }
    const rec: MessageRecord = { ...m, id: uid("msg"), createdAt: new Date().toISOString() };
    this.messageKeys.add(dupKey);
    const list = this.messages.get(m.conversationId) ?? [];
    list.push(rec);
    this.messages.set(m.conversationId, list);
    return rec;
  }

  async getByExternalSession(resortId: string, externalSessionId: string): Promise<ConversationRecord | null> {
    const id = this.byExternal.get(`${resortId}|${externalSessionId}`);
    return id ? (this.conversations.get(id) ?? null) : null;
  }

  /** Test helper: seed a conversation. */
  __seedConversation(rec: ConversationRecord) {
    this.conversations.set(rec.id, rec);
    this.byExternal.set(`${rec.resortId}|${rec.externalSessionId}`, rec.id);
    this.messages.set(rec.id, []);
  }
}

export class MemoryLeadRepository implements LeadRepository {
  private leads = new Map<string, LeadRecord>();
  private byConversation = new Map<string, string>(); // conversationId -> leadId

  async get(id: string): Promise<LeadRecord | null> {
    return this.leads.get(id) ?? null;
  }

  async createOrUpdateByConversation(
    resortId: string,
    conversationId: string,
    data: Partial<LeadRecord>,
  ): Promise<LeadRecord> {
    const existingId = this.byConversation.get(conversationId);
    if (existingId) {
      const updated = { ...this.leads.get(existingId)!, ...data, resortId, conversationId };
      this.leads.set(existingId, updated);
      return updated;
    }
    const rec: LeadRecord = {
      id: uid("lead"),
      resortId,
      conversationId,
      channel: data.channel ?? "website",
      status: data.status ?? "new",
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.leads.set(rec.id, rec);
    this.byConversation.set(conversationId, rec.id);
    return rec;
  }
}

export class MemoryRateRequestRepository implements RateRequestRepository {
  private items = new Map<string, RateRequestRecord>();
  async create(data: Omit<RateRequestRecord, "id" | "createdAt" | "status"> & { status?: string }): Promise<RateRequestRecord> {
    const rec: RateRequestRecord = { ...data, id: uid("rate"), status: data.status ?? "pending", createdAt: new Date().toISOString() };
    this.items.set(rec.id, rec);
    return rec;
  }
  async get(id: string): Promise<RateRequestRecord | null> {
    return this.items.get(id) ?? null;
  }
}

export class MemoryApprovalRepository implements ApprovalRepository {
  private items = new Map<string, ApprovalRecord>();
  async create(data: Omit<ApprovalRecord, "id" | "createdAt" | "status"> & { status?: string }): Promise<ApprovalRecord> {
    const rec: ApprovalRecord = { ...data, id: uid("apr"), status: data.status ?? "pending", createdAt: new Date().toISOString() };
    this.items.set(rec.id, rec);
    return rec;
  }
  async get(id: string): Promise<ApprovalRecord | null> {
    return this.items.get(id) ?? null;
  }
  async update(id: string, patch: Partial<ApprovalRecord>): Promise<ApprovalRecord> {
    const cur = this.items.get(id);
    if (!cur) throw new Error(`Approval ${id} not found`);
    const next = { ...cur, ...patch };
    this.items.set(id, next);
    return next;
  }
}

export class MemoryFollowUpRepository implements FollowUpRepository {
  private items: Array<{ id: string; resortId: string; leadId: string; dueAt?: string }> = [];
  async create(resortId: string, leadId: string, dueAt?: string): Promise<{ id: string }> {
    const rec = { id: uid("fu"), resortId, leadId, dueAt };
    this.items.push(rec);
    return rec;
  }
}

export class MemoryActivityRepository implements ActivityRepository {
  private items: ActivityRecord[] = [];
  async log(data: Omit<ActivityRecord, "id" | "createdAt">): Promise<ActivityRecord> {
    const rec: ActivityRecord = { ...data, id: uid("act"), createdAt: new Date().toISOString() };
    this.items.push(rec);
    return rec;
  }
}

export interface MemoryAdapter extends ResortAgentRepositories {
  __conversations: MemoryConversationRepository;
  __leads: MemoryLeadRepository;
}

export function createMemoryRepositories(): MemoryAdapter {
  const __conversations = new MemoryConversationRepository();
  const __leads = new MemoryLeadRepository();
  return {
    conversations: __conversations,
    leads: __leads,
    rateRequests: new MemoryRateRequestRepository(),
    approvals: new MemoryApprovalRepository(),
    followUps: new MemoryFollowUpRepository(),
    activity: new MemoryActivityRepository(),
    __conversations,
    __leads,
  };
}
