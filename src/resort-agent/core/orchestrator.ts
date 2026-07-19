/**
 * Resort Agent orchestrator — the single reusable entry point.
 *
 * Flow (per governing spec + Onyx resort-agent.md brain):
 *   Guest message
 *   -> intent classification
 *   -> knowledge retrieval (non-monetary only)
 *   -> verified-answering rules
 *   -> guest-detail extraction
 *   -> action decision
 *   -> approval decision
 *   -> safe response
 *   -> temporary persistence result
 *
 * The absolute pricing rule is enforced three ways:
 *   1. Intent layer: rate questions never receive stored monetary knowledge.
 *   2. Knowledge layer: monetary categories excluded from retrieval.
 *   3. Response layer: any monetary output is sanitized to the approved reply.
 *
 * Source attribution: orchestration + action levels ported from Onyx
 * skills/builtin/resort-agent (MIT). BAIA-specific wiring is in src/baia.
 */
import type {
  AgentAction,
  GuestExtractedDetails,
  RunResortAgentInput,
  RunResortAgentResult,
} from "../types.ts";
import { classifyIntent } from "./intent.ts";
import { extractDetails, validateDetails } from "../qualification/qualification.ts";
import { answerAvailability } from "../availability/availability.ts";
import { handleComplaint } from "../complaints/complaints.ts";
import { buildRateRequest, missingRateFields } from "../rate-requests/rate-requests.ts";
import { holdForApproval } from "../approvals/approvals.ts";
import { getRepositories, isSupabaseConfirmed } from "../adapters/index.ts";
import { sanitizeReply } from "../../baia/concierge.guardrails.ts";

export interface RunOptions {
  /** Provide a model provider only if you want generated (non-rule) replies. */
  model?: import("../core/model-provider.ts").AgentModelProvider;
  /** Knowledge bag for non-monetary retrieval (already sanitized upstream). */
  knowledge?: RunResortAgentInput["knowledge"];
  /** Actor label for activity log. */
  actor?: string;
}

/**
 * Run the Resort Agent for one guest message. Returns a safe, structured
 * result. All persistence goes through the selected repository adapter and is
 * marked databaseWriteDeferred when the backing store is not the confirmed
 * Supabase instance.
 */
export async function runResortAgent(
  input: RunResortAgentInput,
  opts: RunOptions = {},
): Promise<RunResortAgentResult> {
  const { resortId, channel, sessionId, messageId, message, guest, priorDetails } = input;
  // Knowledge: prefer the input bag, fall back to opts (both must be
  // non-monetary; the knowledge layer already excludes prices).
  const knowledge = input.knowledge ?? opts.knowledge;
  const repos = getRepositories();
  const deferred = !isSupabaseConfirmed();

  // 1. Intent (deterministic, pre-model).
  const { intent, isSensitive } = classifyIntent(message);

  // 2. Extract details (never invented).
  const extracted: GuestExtractedDetails = validateDetails(
    extractDetails(message, priorDetails ?? {}),
  );

  // 3. Ensure conversation + message rows exist (idempotent).
  const conversation = await repos.conversations.upsertConversation({
    resortId,
    channel,
    externalSessionId: sessionId,
    guestName: guest?.name,
    email: guest?.email,
    phone: guest?.phone,
  });
  await repos.conversations.appendMessage({
    conversationId: conversation.id,
    resortId,
    role: "guest",
    content: message,
    msgExternalId: messageId,
  });

  const actions: AgentAction[] = [];
  let reply = "";
  let approvalRequired = false;

  // 4. Routing by intent.
  switch (intent) {
    case "complaint": {
      const r = handleComplaint(message);
      reply = r.reply;
      actions.push(...r.actions);
      approvalRequired = r.actions.some((a) => a.status === "pending_approval");
      break;
    }
    case "rate_request": {
      // Never quote. Collect details + create a rate request (owner task).
      const { draft, reply: rateReply } = buildRateRequest(extracted, guest);
      const missing = missingRateFields(draft);
      const rr = await repos.rateRequests.create({
        resortId,
        leadId: undefined,
        guestName: draft.guestName,
        checkIn: draft.checkIn,
        checkOut: draft.checkOut,
        adults: draft.adults,
        children: draft.children,
        roomPreference: draft.roomPreference,
        transportNeeded: draft.transportNeeded,
        contactDetails: draft.contactDetails,
        status: "pending",
      });
      actions.push({ type: "draft_rate_request", status: "draft", ref: rr.id });
      approvalRequired = true;
      // If we still need details, ask; otherwise give the policy reply.
      reply = missing.length
        ? `To prepare today's rate for you, may I have your ${missing.join(", ")}?`
        : rateReply;
      break;
    }
    case "availability": {
      const guests = extracted.adults ?? 2;
      const r = answerAvailability(knowledge, guests);
      reply = r.reply;
      actions.push({ type: "answer_availability", status: "draft" });
      break;
    }
    case "booking_inquiry":
    case "guest_service":
    default: {
      // Verified-answering: use provided knowledge or a safe fallback.
      reply = answerGeneral(message, knowledge, intent);
      actions.push({ type: "answer_faq", status: "draft" });
      // Capture a lead when we have any booking signal.
      if (intent === "booking_inquiry" || extracted.checkIn || extracted.adults) {
        const lead = await repos.leads.createOrUpdateByConversation(resortId, conversation.id, {
          channel,
          guestName: guest?.name,
          email: guest?.email,
          phone: guest?.phone,
          checkIn: extracted.checkIn,
          checkOut: extracted.checkOut,
          guestCount: extracted.adults,
          childrenCount: extracted.children,
          roomPreference: extracted.roomPreference,
          transportNeeded: extracted.transportNeeded,
          status: "qualifying",
        });
        actions.push({ type: "create_guest_lead", status: "draft", ref: lead.id });
      }
      break;
    }
  }

  // 5. If any action required approval and we built content, hold it.
  const needsHold = actions.some((a) => a.status === "pending_approval");
  if (needsHold && !reply.includes("confirm")) {
    const { holdMessage } = holdForApproval({
      resortId,
      sessionId,
      actionType: "escalate_with_compensation",
      draftContent: reply,
      riskLevel: "high",
    });
    reply = reply + " " + holdMessage;
  }

  // 6. Persist agent reply (canonical message store).
  await repos.conversations.appendMessage({
    conversationId: conversation.id,
    resortId,
    role: "agent",
    content: reply,
    msgExternalId: `agent_${messageId}`,
  });

  // 7. Activity log (no secrets).
  await repos.activity.log({
    resortId,
    actor: opts.actor ?? "agent",
    action: `intent:${intent}`,
    entityType: "conversation",
    entityId: conversation.id,
    summary: `Handled ${intent} for ${channel} session ${sessionId}`,
  });

  // 8. Response-layer sanitization (monetary output -> approved reply). Fail safe.
  const guarded = sanitizeReply(reply, intent === "rate_request" ? "rate_request" : "general");

  return {
    resortId,
    reply: guarded.reply,
    intent,
    approvalRequired: approvalRequired || guarded.approvalRequired,
    databaseWriteDeferred: deferred,
    extractedDetails: extracted,
    actions,
  };
}

/** Non-monetary general answering from the knowledge bag. */
function answerGeneral(
  message: string,
  knowledge: RunResortAgentInput["knowledge"] | undefined,
  intent: string,
): string {
  const lower = message.toLowerCase();
  // Room description request.
  const roomHit = knowledge?.rooms?.find((r) =>
    lower.includes(r.name.toLowerCase()) ||
    (intent === "guest_service" && lower.includes("room")),
  );
  if (roomHit) {
    return `${roomHit.name}: ${roomHit.description} Sleeps up to ${roomHit.maxOccupancy}. Features: ${roomHit.features.join(", ")}.`;
  }
  // FAQ exact match.
  const faq = knowledge?.faqs?.find((f) => lower.includes(f.question.toLowerCase().slice(0, 12)));
  if (faq) return faq.answer;
  // Transport.
  const transport = knowledge?.transport?.find((t) => lower.includes("transfer") || lower.includes("airport"));
  if (transport) return transport.description;
  // Destination.
  const attr = knowledge?.destination?.attractions?.[0];
  if (attr && (lower.includes("do") || lower.includes("visit") || lower.includes("experience"))) {
    return `A guest favourite nearby is ${attr.name}: ${attr.description}`;
  }
  return (
    "Happy to help! For the most accurate and current information, our team can " +
    "assist directly — feel free to share your dates and preferences and we'll " +
    "point you to the right place."
  );
}
