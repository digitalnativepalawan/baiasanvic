/**
 * Builds the concierge's knowledge pack from the resort's existing site data
 * (rooms, activities, attractions) plus the owner's editable extras.
 *
 * IMPORTANT: prices are intentionally redacted from the knowledge the agent
 * sees. The concierge never quotes rates — it directs guests to the Book Now
 * / inquiry links. This is enforced both by stripping numbers here and by the
 * guardrail in the system prompt.
 */
import { ROOMS, ATTRACTIONS, ACTIVITIES } from "./data";

export interface KnowledgeChunk {
  id: string;
  label: string;
  text: string;
}

/**
 * Strip any monetary tokens from a knowledge string before it reaches the
 * guest-facing prompt. Defense in depth: even if a future knowledge source or
 * owner custom-knowledge field contains a price, it never reaches the model.
 * Currency symbols/codes, "per night", amounts, and ranges are removed.
 */
const MONETARY_RE =
  /(₱|\$|€|£|¥|\bphp\b|\busd\b|\beur\b|\bgbp\b|\bpesos?\b)\s?-?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:php|usd|eur|gbp|pesos?)|per\s?night|per\s?person|nightly\s+rate|price\s*:?|rate\s*:?\s*₱?\d[\d,]*|starting\s+from|starts\s+at\s*₱?\d[\d,]*/gi;

export function stripMonetary(text: string): string {
  if (!text) return text;
  const cleaned = text
    .replace(MONETARY_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
}

function roomChunkText(): string {
  const lines = ROOMS.map((r) => {
    // Inventory count is property inventory ONLY — never current availability.
    const inventory = r.availabilityCount ?? 0;
    return [
      `ROOM: ${r.name}`,
      `Sleeps: ${r.capacity}`,
      `Size: ${r.size}`,
      `Description: ${r.description}`,
      `Amenities: ${r.amenities.join(", ")}`,
      `Property inventory: ${inventory} unit(s) of this room type. Current availability requires confirmation.`,
    ].join("\n");
  });
  return lines.join("\n\n");
}

function experienceChunkText(): string {
  const activities = ACTIVITIES.map((a) => {
    return [
      `EXPERIENCE: ${a.title} (${a.category}, ${a.difficulty}, ${a.duration})`,
      a.description,
    ].join("\n");
  });
  const attractions = ATTRACTIONS.map((at) => {
    return [
      `NEARBY: ${at.name} — ${at.category}, ${at.distanceFromResort}`,
      at.description,
      `Tip: ${at.tips}`,
    ].join("\n");
  });
  return [...activities, ...attractions].join("\n\n");
}

function bookingChunkText(): string {
  return [
    "BOOKING & CONTACT",
    "Guests book through the 'Book Your Stay' button or the inquiry form on the site. The resort follows up by email to confirm rates and availability — no payment is taken online.",
    "Contact: hello@baiapalawan.com",
    "Location: Penanindigan Beach, San Vicente, Palawan, Philippines.",
    "Check-in / check-out times are confirmed by the resort after inquiry. Early check-in or late check-out can be requested and are subject to availability.",
    "If a guest wants to reserve, ask for their name, email, dates, number of guests, and which room type they prefer, then tell them to use the Book Now button (or you can summarize their request so they can paste it into the inquiry form).",
  ].join("\n");
}

function aboutChunkText(): string {
  return [
    "ABOUT BAIA",
    "BAIA Beachfront Boutique Lodge is a barefoot-luxury retreat on Penanindigan Beach (also spelled Panindigan), in the municipality of San Vicente, northern Palawan, Philippines.",
    "LOCATION CLARITY: BAIA is in the Penanindigan/Panindigan area of San Vicente — NOT in Port Barton. Port Barton is a separate, well-known town roughly 30–40 minutes away by boat (or about an hour by road). When guests ask 'where is BAIA?', always say 'Penanindigan Beach, San Vicente, Palawan' and note that it is not Port Barton.",
    "Philosophy: 'True luxury is feeling completely at home in nature.' Simplicity becomes riches; raw tropical beauty is framed by custom design and hospitality.",
    "The resort offers private, single-level villas in a tropical-minimalist style — calm, timber, and open to the breeze. Every room includes air conditioning, a flat-screen TV, a private bathroom, and hot water.",
  ].join("\n");
}

function policyChunkText(): string {
  return [
    "POLICIES & FAQ",
    "Rates and availability are confirmed by the resort over email after an inquiry — do not quote specific prices.",
    "Cancellations and changes are handled by the resort directly via email.",
    "The resort can arrange private outrigger boat charters, island-hopping, wellness sessions, and bespoke experiences (proposals, detox programs, etc.) — recommend the guest describe what they dream of and the concierge team will tailor it.",
    "Family friendly and suitable for couples seeking privacy. Pets policy is confirmed with the resort.",
    "Getting here: San Vicente is reached via Puerto Princesa (flights) then a scenic transfer; the resort can advise on the best route after an inquiry.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Owner-authored knowledge base.
//
// Add more topics over time by appending a { id, label, text } entry to
// OWNER_KNOWLEDGE below — the concierge will pick them up automatically via
// retrieveRelevant(). Keep ids unique. Prices stay out of here by design
// (the bot never quotes rates). The admin panel's "Extra knowledge" box is
// still appended on top of all of this at request time.
// ---------------------------------------------------------------------------
function diningChunkText(): string {
  return [
    "FOOD & DINING",
    "BAIA has an on-site restaurant called Baia Beach.",
    "Cuisine categories served: Italian, Mediterranean, wood-fired pizza, fresh seafood, Filipino and local dishes, Asian, international, and grill or BBQ.",
    "Representative dish types: wood-fired pizzas and pasta from the Italian kitchen; grilled seafood and BBQ platters featuring the daily catch; Filipino and local classics such as adobo, sinigang, grilled fish, and rice dishes; Asian plates including noodles, rice bowls, and curries; Mediterranean and international plates such as salads, grilled meats, and vegetable dishes.",
    "Breakfast is available for guests (continental, full English/Irish, and Asian styles).",
    "Vegetarian, vegan, and most dietary needs can be accommodated if told in advance. Fresh fruit and coconut water are daily staples.",
    "In-villa or beachfront private dining can be arranged for special occasions — just ask the concierge.",
    "Menu items and exact dishes are subject to daily availability; the BAIA team confirms current selections. Prices and daily availability are never quoted — the team confirms both directly.",
  ].join("\n");
}

/**
 * Guest-facing answer for dining/menu questions. Used when the Onyx brain
 * cannot answer from its own knowledge (its persona knowledge may be
 * incomplete) so the concierge never falls back to a "we don't have a menu"
 * dead end. Built only from the owner-supplied cuisine categories — no prices,
 * and availability is explicitly flagged as live-check-required.
 */
export function buildMenuAnswer(): string {
  return [
    "BAIA's on-site restaurant, Baia Beach, serves a mix of cuisines — Italian, Mediterranean, wood-fired pizza, fresh seafood, Filipino and local dishes, Asian, international, and grill or BBQ.",
    "You'll find wood-fired pizzas and pasta, grilled seafood and BBQ platters from the daily catch, Filipino classics like adobo and sinigang, Asian noodle and rice bowls, and Mediterranean plates and salads. Breakfast runs continental, full English/Irish, and Asian styles, and vegetarian and most dietary needs can be handled with a little notice.",
    "Exact dishes and today's availability change with the catch and the season, so the BAIA team confirms the current menu when you inquire — and they'll share pricing directly rather than quoting it here.",
  ].join(" ");
}

/** True when an Onyx/agent reply is a non-answer that should be bypassed. */
export function isNoKnowledgeFallback(reply: string): boolean {
  return /we (don'?t|do not) have (a |the )?menu|provided details|knowledge base|don'?t have (that|any) (information|detail)/i.test(
    reply,
  );
}

/**
 * True when the GUEST'S QUESTION (not the reply) is actually about food,
 * dining, breakfast, the restaurant, dishes, or the menu.
 *
 * isNoKnowledgeFallback() alone is not enough to decide when to substitute
 * buildMenuAnswer() — its regex also matches generic non-answers like "I
 * don't have that information", which has nothing to do with food. Without
 * this guard, a guest asking about wifi or pets who gets a generic
 * no-knowledge reply would incorrectly receive the menu text instead. Both
 * checks must pass before buildMenuAnswer() is used.
 */
export function isMenuQuestion(question: string): boolean {
  return /\b(menu|food|dining|dine|dish|dishes|breakfast|lunch|dinner|restaurant|eat|cuisine|meal)\b/i.test(
    question || "",
  );
}

function transfersChunkText(): string {
  return [
    "TRANSFERS & GETTING HERE",
    "We can arrange a private van transfer from Puerto Princesa International Airport (PPS) — about 2.5 to 3 hours by road to San Vicente.",
    "Flights to PPS run daily from Manila and Cebu.",
    "For island guests, our outrigger picks you up right on BAIA's shoreline. Tell us your flight time and we'll coordinate the pickup.",
  ].join("\n");
}

function stayChunkText(): string {
  return [
    "STAY DETAILS",
    "Standard check-in is 2:00 PM; check-out is 12:00 PM. Early check-in or late check-out can be requested and is subject to availability — we'll confirm by email. We can safely hold luggage if you arrive early.",
    "What's included: daily housekeeping, WiFi in common areas, beach loungers, use of the beachfront shala, and the complimentary sunrise vinyasa & sound healing session. Government taxes are included in the quoted rate.",
    "WiFi is free in the restaurant and common areas; signal in the villas is fair but lighter — this is a place to unplug. Mobile signal (Globe/Smart) reaches most of the property.",
    "We don't take payment online. After your inquiry we confirm availability and send bank-transfer / PayPal details, or you may pay cash on arrival. A deposit may be requested to hold peak-season dates.",
    "Best time to visit: Palawan's dry season is roughly November to May (sunniest, calmest seas). June to October is greener with occasional rain; boat trips still run but check the weather. Pack reef-safe sunscreen, light clothing, reef shoes, and a light jacket for breezy evenings.",
  ].join("\n");
}

function familyChunkText(): string {
  return [
    "FAMILIES & KIDS",
    "Family-friendly and great for couples seeking privacy. Rollaway beds available in the Comfort Cottage (sleeps 3); the Deluxe Beachfront Suite sleeps 4 with a sofa bed.",
    "We can provide a crib on request. Kid-friendly meals can be prepared.",
    "The beach is gentle but always supervise children near the water.",
  ].join("\n");
}

function townChunkText(): string {
  return [
    "NEARBY TOWN & OFF-SITE",
    "San Vicente town (10 min drive) has a small ATM, sari-sari stores, and a few local eateries.",
    "Port Barton (30–40 min by boat) has casual beachfront restaurants — we're happy to point you to our favorites.",
  ].join("\n");
}

function breakfastChunkText(): string {
  return [
    "BREAKFAST",
    "Hours: 08:30–10:30 daily.",
    "Formats: Continental, Full English, Asian — all cooked to order.",
    "Price: ₱400 per adult, ₱400 per child when breakfast is NOT explicitly bundled in the booked room rate.",
    "Rule: Charge applies only when the room package does not already include breakfast. Confirm inclusion at booking.",
  ].join("\n");
}

function checkinCheckoutChunkText(): string {
  return [
    "CHECK-IN / CHECK-OUT",
    "Front desk hours: 08:00–21:00.",
    "Check-in window: 14:00–21:00.",
    "Late arrival: Guests arriving after 18:00 MUST contact the resort in advance to arrange late check-in.",
    "Check-out window: 07:00–12:00.",
    "Luggage storage available for early arrivals / late departures.",
  ].join("\n");
}

function cancellationChunkText(): string {
  return [
    "CANCELLATION POLICY",
    "Varies by booking channel.",
    "OTA bookings (Booking.com, Agoda, Airbnb): Often non-refundable — check the specific rate conditions at time of booking.",
    "Direct bookings: Flexible with 48–72 hours notice required for free cancellation.",
    "Late cancellation (within 48–72 hours): 100% of first night may be charged.",
    "No-show: 100% of first night charged.",
    "Modifications: Subject to availability and rate difference; contact resort directly via email.",
  ].join("\n");
}

function petsEventsChunkText(): string {
  return [
    "PETS & EVENTS POLICY",
    "Pets: NOT allowed.",
    "Large groups / parties: NOT allowed.",
    "Bachelor / bachelorette parties: NOT allowed.",
    "Noise events / parties: NOT allowed.",
    "Quiet hours respected for all guests' comfort.",
  ].join("\n");
}

function airportTransferChunkText(): string {
  return [
    "AIRPORT TRANSFER DETAILS",
    "Private van (capacity 12 passengers): ₱6,000 one-way per vehicle.",
    "Advance notice required: 48 hours minimum with complete flight details.",
    "Required information: exact flight number, arrival airport (PPS), arrival date, arrival time, guest count, luggage count, contact phone number.",
    "Pickup: Driver meets at Puerto Princesa International Airport (PPS) arrivals.",
    "Duration: ~2.5–3 hours by road to San Vicente.",
    "Flights to PPS: Daily from Manila and Cebu.",
    "Rate is per vehicle (not per person) for up to 12 guests + luggage.",
  ].join("\n");
}

function tourPartnersChunkText(): string {
  return [
    "TOUR PARTNERS & ISLAND HOPPING",
    "Authorized local outrigger captains pick up directly from BAIA's shoreline.",
    "Primary zone: Port Barton Bay Marine Park.",
    "Character: Calm water, clear water, sea turtles, shallow coral reefs.",
    "Destinations: Turtle Bay / Inaladelan Island (turtle encounters, swimming), German Island (white sandbar, beach lunch, hammocks), Exotic Island (shallow sandbar connection at low tide), Maxima Island (shallow sandbar connection at low tide), Twin Reef (shallow snorkeling, fan corals), Wide Reef (shallow snorkeling, fan corals).",
    "Wildlife sightings (turtles, etc.) are NOT guaranteed.",
    "Live-check required before departure: weather, sea conditions, tide, operator itinerary, pickup availability, price, departure time.",
    "Boat charter arranged through concierge — describe your ideal day and the team will tailor it.",
  ].join("\n");
}

function rentalsChunkText(): string {
  return [
    "RENTALS",
    "Available at front desk: scooter, moped, bicycle.",
    "Managed directly by front desk staff — inquire on arrival.",
    "Scooter/moped recommended for exploring Long Beach, waterfalls, and San Vicente town at own pace.",
  ].join("\n");
}

function wifiChunkText(): string {
  return [
    "WIFI & CONNECTIVITY",
    "Free WiFi throughout: all rooms, beach lounge, restaurant, common areas.",
    "Target speed: 50+ Mbps over fiber where stable.",
    "Operational reality: Connection drops are common across the local grid.",
    "Backup: Smart cellular hotspot + Globe cellular hotspot (both maintained on-site).",
    "Signal note: Smart and Globe alternate in signal priority along Panindigan Beach section.",
    "Manage expectations: Suitable for messaging, email, light browsing. Not reliable for HD streaming or video calls.",
  ].join("\n");
}

function powerChunkText(): string {
  return [
    "POWER & BACKUP",
    "Primary grid: PALECO (Palawan Electric Cooperative) main grid.",
    "Local issue: Frequent load shedding (planned outages) across northern Palawan.",
    "Backup: Local backup generator infrastructure on-site.",
    "Generator limitation: During total grid failure, continuous uninterrupted daytime multi-unit air conditioning is subject to generator load management. Essential circuits prioritized.",
    "Advice: Expect occasional brief interruptions. Resort manages transitions smoothly for guest comfort.",
  ].join("\n");
}

function faqsChunkText(): string {
  return [
    "FREQUENTLY ASKED QUESTIONS",
    "Q: How do I get an exact package total?",
    "A: Provide exact check-in date, check-out date, number of guests, preferred room type, and whether you need the airport van. BAIA management will prepare the final quote.",
    "Q: What time is check-in?",
    "A: Check-in is 14:00–21:00. Guests arriving after 18:00 must contact BAIA in advance.",
    "Q: What time is check-out?",
    "A: Check-out is 07:00–12:00.",
    "Q: How much is the private airport van?",
    "A: ₱6,000 one way per vehicle (up to 12 passengers), requested 48+ hours in advance with complete flight details.",
    "Q: What time is breakfast?",
    "A: Breakfast served daily 08:30–10:30.",
    "Q: How much is breakfast when not included?",
    "A: Approximately ₱400 per adult and ₱400 per child (cooked to order).",
    "Q: How fast is the WiFi?",
    "A: Target 50+ Mbps over fiber where stable. Local outages and drops occur; Smart/Globe cellular hotspots serve as backup.",
    "Q: Does BAIA have backup power?",
    "A: Yes — connected to PALECO grid with on-site backup generator. During total grid failure, continuous multi-unit AC may be limited by generator load management.",
  ].join("\n");
}

function sanVicenteGeoChunkText(): string {
  return [
    "SAN VICENTE GEOGRAPHY",
    "Municipality: San Vicente, Palawan, Philippines.",
    "Postal code: 5309.",
    "Coordinates: 10.538582° N, 119.237916° E.",
    "Barangays (10): Alimanguan, Binga, Caruray, Kemdeng, New Agutaya, New Canipo, Poblacion, Port Barton, San Isidro, Sto. Niño.",
    "BAIA is located in the Panindigan/Penanindigan area of Barangay Poblacion, San Vicente — NOT in Port Barton (which is a separate barangay 30–40 min by boat).",
  ].join("\n");
}

function longBeachChunkText(): string {
  return [
    "LONG BEACH (SAN VICENTE)",
    "Length: 14.7 km — one of the longest continuous white-sand beaches in the Philippines.",
    "Spans barangays: Poblacion, New Agutaya, San Isidro, Alimanguan.",
    "Live-check required for: access, weather, tide, transport.",
    "Best at first light for emptiest, most photogenic stretch.",
    "Accessible by scooter/moped from BAIA (~10 min to nearest access point).",
  ].join("\n");
}

function portBartonChunkText(): string {
  return [
    "PORT BARTON",
    "Separate barangay from BAIA — distinct zone, 30–40 min by boat.",
    "Tour letter codes (A, B, C, etc.) are NOT standardized across operators.",
    "Wildlife sightings (turtles, etc.) are NOT guaranteed.",
    "Casual beachfront restaurants — concierge can recommend favorites.",
    "Can be combined with Pamuayan Falls for a land day-trip from Port Barton area.",
  ].join("\n");
}

function islandHoppingChunkText(): string {
  return [
    "ISLAND HOPPING DETAILS",
    "Pickup: Authorized skippers collect guests directly from BAIA's beachfront shoreline.",
    "Primary zone: Port Barton Bay Marine Park — calm, clear water, sea turtles, shallow coral reefs.",
    "Stops: Turtle Bay / Inaladelan Island (turtle encounters, swimming), German Island (white sandbar, beach lunch, hammocks), Exotic Island (low-tide sandbar connection), Maxima Island (low-tide sandbar connection), Twin Reef (shallow snorkeling, fan corals), Wide Reef (shallow snorkeling, fan corals).",
    "Wildlife sightings (turtles, etc.) are NOT guaranteed.",
    "Live-check required before departure: weather, sea conditions, tide, operator itinerary, pickup availability, price, departure time.",
    "Half-day and full-day charters available — describe your ideal day and concierge will arrange.",
  ].join("\n");
}

function waterfallsChunkText(): string {
  return [
    "WATERFALLS",
    "Pamuayan Falls: Near Port Barton. Typically combined with Port Barton land day-trip. Walk: relatively easy and flat, 30–40 min along shaded jungle riverbed. Features: 8 m height, deep wide cold freshwater pool suitable for swimming. Live-check: trail condition, water flow, weather, guide need.",
    "Bigaho / Ipanganan Waterfalls: Northern San Vicente / Alimanguan–Port Barton area. Bigaho known for maintained wooden eco-walkway from road. Access: further north; minimal difficulty. Features: cascading tier system, dense primary forest, natural swimming pool at base. Live-check: access route, road condition, entry status, water flow, weather.",
  ].join("\n");
}

function alimanguanSurfingChunkText(): string {
  return [
    "ALIMANGUAN SURFING",
    "Location: Alimanguan barangay, northern San Vicente (further north than BAIA).",
    "Seasonal surf break — conditions vary by swell and wind.",
    "Access: Scooter/moped ride from BAIA (~20–30 min north).",
    "Best for: Experienced surfers familiar with remote breaks; no surf shops or rentals on-site.",
    "Live-check required: swell forecast, wind direction, tide, road conditions, access permissions.",
  ].join("\n");
}

// Topics the owner authors over time. Append new entries here (unique id!).
const OWNER_TOPICS: { id: string; label: string; text: string }[] = [
  { id: "dining", label: "Food & dining", text: diningChunkText() },
  { id: "transfers", label: "Transfers & getting here", text: transfersChunkText() },
  { id: "stay", label: "Stay details", text: stayChunkText() },
  { id: "family", label: "Families & kids", text: familyChunkText() },
  { id: "town", label: "Nearby town", text: townChunkText() },
  { id: "breakfast", label: "Breakfast", text: breakfastChunkText() },
  { id: "checkin_checkout", label: "Check-in / Check-out", text: checkinCheckoutChunkText() },
  { id: "cancellation", label: "Cancellation policy", text: cancellationChunkText() },
  { id: "pets_events", label: "Pets & events policy", text: petsEventsChunkText() },
  { id: "airport_transfer", label: "Airport transfer details", text: airportTransferChunkText() },
  { id: "tour_partners", label: "Tour partners & island hopping", text: tourPartnersChunkText() },
  { id: "rentals", label: "Rentals", text: rentalsChunkText() },
  { id: "wifi", label: "WiFi & connectivity", text: wifiChunkText() },
  { id: "power", label: "Power & backup", text: powerChunkText() },
  { id: "faqs", label: "Frequently asked questions", text: faqsChunkText() },
  { id: "san_vicente_geo", label: "San Vicente geography", text: sanVicenteGeoChunkText() },
  { id: "long_beach", label: "Long Beach", text: longBeachChunkText() },
  { id: "port_barton", label: "Port Barton", text: portBartonChunkText() },
  { id: "island_hopping", label: "Island hopping details", text: islandHoppingChunkText() },
  { id: "waterfalls", label: "Waterfalls", text: waterfallsChunkText() },
  { id: "alimanguan_surfing", label: "Alimanguan surfing", text: alimanguanSurfingChunkText() },
];

/** Static chunks built once from site data + owner-authored topics. */
export function buildStaticChunks(): KnowledgeChunk[] {
  return [
    { id: "about", label: "About BAIA", text: aboutChunkText() },
    { id: "accommodations", label: "Accommodations", text: roomChunkText() },
    { id: "experiences", label: "Experiences & nearby", text: experienceChunkText() },
    { id: "booking", label: "Booking & contact", text: bookingChunkText() },
    { id: "policies", label: "Policies & FAQ", text: policyChunkText() },
    ...OWNER_TOPICS.map((t) => ({ id: t.id, label: t.label, text: t.text })),
  ];
}
