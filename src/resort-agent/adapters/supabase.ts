/**
 * Supabase persistence adapter — IMPLEMENTED but DISABLED by default.
 *
 * Status: UNVERIFIED until the owner confirms the manual SQL
 * (supabase/manual_sql/001_resorts_and_operations.sql) ran successfully in
 * Lovable.dev. It is selected only when RESORT_AGENT_PERSISTENCE=supabase AND
 * the SQL is confirmed. Until then the memory adapter is used and every write
 * reports databaseWriteDeferred: true.
 *
 * This adapter maps core records onto the SQL schema tables:
 *   guest_conversations, guest_messages, booking_leads, rate_requests,
 *   approval_requests, follow_ups, activity_log.
 *
 * It uses the project's existing server-only Supabase client (service role),
 * never the browser client. The browser must never import this file.
 *
 * Ported column mapping from Onyx store.py / tools (resort_id carries the
 * stable multi-resort boundary; BAIA = 'baia-san-vicente').
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ResortAgentRepositories } from "./repositories.ts";
import type {
  ConversationRecord,
  LeadRecord,
  RateRequestRecord,
  ApprovalRecord,
  ActivityRecord,
} from "./repositories.ts";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export class SupabaseConversationRepository {
  async upsertConversation(c: Omit<ConversationRecord, "id" | "createdAt">): Promise<ConversationRecord> {
    const { data, error } = await supabaseAdmin
      .from("guest_conversations")
      .upsert(
        {
          resort_id: c.resortId,
          channel: c.channel,
          external_session_id: c.externalSessionId,
          guest_name: c.guestName,
          email: c.email,
          phone: c.phone,
        },
        { onConflict: "resort_id,external_session_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return { ...c, id: data.id, createdAt: data.created_at };
  }

  async appendMessage(m: Omit<ConversationRecord extends never ? never : any, "id" | "createdAt">): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from("guest_messages")
      .upsert(
        {
          conversation_id: m.conversationId,
          resort_id: m.resortId,
          role: m.role,
          content: m.content,
          msg_external_id: m.msgExternalId,
        },
        { onConflict: "conversation_id,msg_external_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getByExternalSession(resortId: string, externalSessionId: string): Promise<ConversationRecord | null> {
    const { data } = await supabaseAdmin
      .from("guest_conversations")
      .select("*")
      .eq("resort_id", resortId)
      .eq("external_session_id", externalSessionId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      resortId: data.resort_id,
      channel: data.channel,
      externalSessionId: data.external_session_id,
      guestName: data.guest_name,
      email: data.email,
      phone: data.phone,
      createdAt: data.created_at,
    };
  }
}

export class SupabaseLeadRepository {
  async createOrUpdateByConversation(
    resortId: string,
    conversationId: string,
    data: Partial<LeadRecord>,
  ): Promise<LeadRecord> {
    const { data: row, error } = await supabaseAdmin
      .from("booking_leads")
      .upsert(
        {
          resort_id: resortId,
          conversation_id: conversationId,
          channel: data.channel,
          guest_name: data.guestName,
          email: data.email,
          phone: data.phone,
          check_in: data.checkIn,
          check_out: data.checkOut,
          guest_count: data.guestCount,
          children_count: data.childrenCount,
          room_preference: data.roomPreference,
          transport_needed: data.transportNeeded,
          status: data.status ?? "new",
        },
        { onConflict: "conversation_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return { ...data, id: row.id, resortId, conversationId, status: row.status, createdAt: row.created_at } as LeadRecord;
  }
}

export class SupabaseRateRequestRepository {
  async create(data: Omit<RateRequestRecord, "id" | "createdAt" | "status"> & { status?: string }): Promise<RateRequestRecord> {
    const { data: row, error } = await supabaseAdmin
      .from("rate_requests")
      .insert({
        lead_id: data.leadId,
        resort_id: data.resortId,
        guest_name: data.guestName,
        check_in: data.checkIn,
        check_out: data.checkOut,
        adults: data.adults,
        children: data.children,
        room_preference: data.roomPreference,
        transfer_required: data.transportNeeded,
        contact_details: data.contactDetails,
        status: data.status ?? "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return { ...data, id: row.id, status: row.status, createdAt: row.created_at };
  }
}

export class SupabaseApprovalRepository {
  async create(data: Omit<ApprovalRecord, "id" | "createdAt" | "status"> & { status?: string }): Promise<ApprovalRecord> {
    const { data: row, error } = await supabaseAdmin
      .from("approval_requests")
      .insert({
        resort_id: data.resortId,
        lead_id: data.leadId,
        conversation_id: data.conversationId,
        action_type: data.actionType,
        draft_content: data.draftContent,
        risk_level: data.riskLevel,
        status: data.status ?? "pending",
      })
      .select()
      .single();
    if (error) throw error;
    return { ...data, id: row.id, status: row.status, createdAt: row.created_at };
  }
}

export class SupabaseFollowUpRepository {
  async create(resortId: string, leadId: string, dueAt?: string): Promise<{ id: string }> {
    const { data, error } = await supabaseAdmin
      .from("follow_ups")
      .insert({ resort_id: resortId, lead_id: leadId, due_at: dueAt, status: "due" })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id };
  }
}

export class SupabaseActivityRepository {
  async log(data: Omit<ActivityRecord, "id" | "createdAt">): Promise<ActivityRecord> {
    const { data: row, error } = await supabaseAdmin
      .from("activity_log")
      .insert({
        resort_id: data.resortId,
        actor: data.actor,
        action: data.action,
        entity_type: data.entityType,
        entity_id: data.entityId,
        summary: data.summary,
      })
      .select()
      .single();
    if (error) throw error;
    return { ...data, id: row.id, createdAt: row.created_at };
  }
}

export function createSupabaseRepositories(): ResortAgentRepositories {
  return {
    conversations: new SupabaseConversationRepository() as any,
    leads: new SupabaseLeadRepository() as any,
    rateRequests: new SupabaseRateRequestRepository() as any,
    approvals: new SupabaseApprovalRepository() as any,
    followUps: new SupabaseFollowUpRepository() as any,
    activity: new SupabaseActivityRepository() as any,
  };
}
