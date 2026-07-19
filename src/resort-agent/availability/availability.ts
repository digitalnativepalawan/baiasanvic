/**
 * Availability handling. Ported from Onyx check_availability.py semantics:
 * static room counts are PROPERTY INVENTORY only, never live availability.
 * We answer by "room types that fit the guest count" and always mark
 * confirmed=false, directing the guest to live sources. We NEVER confirm a
 * room is available for specific dates from static data.
 */
import type { ResortKnowledgeBag } from "../types.ts";

export interface AvailabilityResult {
  reply: string;
  confirmed: false;
}

export function answerAvailability(
  knowledge: ResortKnowledgeBag | undefined,
  guests: number,
): AvailabilityResult {
  const rooms = (knowledge?.rooms ?? []).filter(
    (r) => r.maxOccupancy >= guests,
  );
  const names = rooms.map((r) => r.name);
  const list = names.length ? names.join(", ") : "our room types";

  const reply =
    `For your party of ${guests}, our property includes: ${list}. ` +
    `Current availability changes daily and requires live confirmation — ` +
    `please check BAIA's listings on Booking.com, Agoda, or Airbnb, or contact ` +
    `our team directly and we'll check real-time availability for your dates.`;

  return { reply, confirmed: false };
}
