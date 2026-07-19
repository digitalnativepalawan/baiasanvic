/**
 * Knowledge loader interfaces — BAIA-agnostic.
 *
 * The core consumes knowledge through these interfaces only. Resort-specific
 * facts (rooms, policies, transport, destination, FAQs) are supplied by an
 * adapter, never hard-coded in the core. Monetary data is EXCLUDED from
 * AI-retrieval-eligible knowledge entirely (see MonetaryExclusion).
 *
 * Prepared to read the normalized working package later:
 *   MERQATO_BAIA_KNOWLEDGE_WORKING_v1.3.zip
 * via a filesystem/fixture adapter for development. The core does not import
 * the package; an adapter maps package categories -> ResortKnowledgeBag and
 * drops monetary categories.
 */
import type { ResortKnowledgeBag } from "../types.ts";

export interface KnowledgeRecord {
  resortId: string;
  category: string;
  content: unknown;
  source: string;
  sourceStatus: string;
  ownerVerified: boolean;
  verifiedAt?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  isActive: boolean;
  /** True if this record is eligible for AI retrieval (monetary = false). */
  aiRetrievalEligible: boolean;
}

export interface KnowledgeRepository {
  loadBag(resortId: string): Promise<ResortKnowledgeBag>;
}

/** Categories that must NEVER reach guest-facing AI retrieval. */
export const MONETARY_CATEGORIES = new Set([
  "rates",
  "transport_price",
  "breakfast_price",
  "deposits",
  "fees",
  "quote",
]);

/** Returns true if a category is monetary and must be excluded from AI. */
export function isMonetaryCategory(category: string): boolean {
  return MONETARY_CATEGORIES.has(category.toLowerCase());
}

/**
 * Build a retrieval-eligible knowledge bag from records, dropping any monetary
 * or inactive or non-verified-for-retrieval records per spec. This is the
 * single guard ensuring no price enters guest-facing retrieval.
 */
export function recordsToBag(records: KnowledgeRecord[]): ResortKnowledgeBag {
  const bag: ResortKnowledgeBag = {};
  for (const r of records) {
    if (!r.isActive || !r.aiRetrievalEligible || isMonetaryCategory(r.category)) continue;
    const c = r.content as Record<string, unknown>;
    switch (r.category) {
      case "identity":
        if (typeof c.business_name === "string") bag.resortName = c.business_name;
        break;
      case "rooms":
        if (Array.isArray(c.room_types)) {
          bag.rooms = (c.room_types as any[]).map((rt) => ({
            name: rt.name,
            description: rt.description ?? "",
            maxOccupancy: rt.maximum_occupancy ?? rt.standard_occupancy ?? 2,
            features: rt.features ?? [],
            beachfront: rt.beachfront,
          }));
        }
        break;
      case "policies":
        bag.policies = c as Record<string, string>;
        break;
      case "transport":
        if (Array.isArray(c.airport_transfers)) {
          bag.transport = (c.airport_transfers as any[]).map((t) => ({
            type: t.type,
            description: `Transfer: ${t.type}. Advance notice: ${t.advance_notice_hours ?? "?"}h.`,
          }));
        }
        break;
      case "destination":
        if (Array.isArray(c.attractions)) {
          bag.destination = {
            attractions: (c.attractions as any[]).map((a) => ({
              name: a.name,
              description: a.description ?? "",
            })),
          };
        }
        break;
      case "faq":
        if (Array.isArray(c.faqs)) {
          bag.faqs = (c.faqs as any[]).map((f) => ({ question: f.question, answer: f.answer }));
        }
        break;
    }
  }
  return bag;
}
