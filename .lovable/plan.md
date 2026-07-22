# Fix the concierge so it actually answers simple BAIA questions

The screenshots show "How do I get there?" and "What rooms do you have?" both dead-ending in the generic "email hello@baiapalawan.com" fallback. That is a bug in the deterministic knowledge layer, not a model/provider problem. Onyx also currently runs first when its env vars are set — you want it on standby, so it needs to be skipped entirely until you flip it back on.

## Root causes (verified in the code)

1. **Retrieval tokenizer drops the wrong words** (`src/baia/concierge.retrieve.ts`)
   - `get` and `from` are in STOPWORDS → "how do I get there" tokenizes to just `["there"]`, matches nothing → contact fallback.
   - No plural/simple stemming → `rooms` never matches `room`, `tours`/`tour`, `menus`/`menu`, `transfers`/`transfer`, `villas`/`villa`, `kids`/`kid`, etc.
   - Result: "What rooms do you have?" tokenizes to `["rooms"]`, scores 0 against the accommodations chunk, falls through.

2. **Deterministic allow-list is stale** (`src/baia/concierge.answer.ts`)
   - `KNOWN_TOPIC_IDS` only lists 11 legacy ids (about, accommodations, experiences, booking, policies, dining, transfers, stay, family, town, custom).
   - The 17 richer owner topics that were added later — `breakfast`, `checkin_checkout`, `cancellation`, `pets_events`, `airport_transfer`, `tour_partners`, `rentals`, `wifi`, `power`, `faqs`, `san_vicente_geo`, `long_beach`, `port_barton`, `island_hopping`, `waterfalls`, `alimanguan_surfing` — are excluded from the deterministic answerer even when they score highest. So questions about tours, airport van, island hopping, WiFi, Long Beach, Port Barton, waterfalls etc. can never be answered deterministically today.

3. **Onyx runs first when env vars are set** (`src/baia/concierge.server.ts`)
   - You want it on standby during low season; today it's tried before OpenRouter for any unknown question, which slows replies and can produce off-brand output.

## What I will change (concierge only — nothing else)

**A. `src/baia/concierge.retrieve.ts`**
- Remove `get` and `from` from STOPWORDS.
- Add a tiny normalizer: lowercase, strip a trailing `s`/`es` for tokens > 3 chars (so `rooms→room`, `tours→tour`, `villas→villa`, `transfers→transfer`, `dishes→dish`). Apply the same normalization to chunk indexing and question tokenization so scoring stays symmetric.
- Add a small synonym expansion map applied only to the question (not the chunks) for common guest phrasings, e.g. `there → baia san vicente location`, `here → baia location`, `van/pickup/shuttle → transfer airport`, `wifi/internet → wifi`, `kids/children → family`, `pet → pets`, `price/rate/cost → rate` (rate questions are already caught by the guardrail — this just keeps them from matching noise).

**B. `src/baia/concierge.answer.ts`**
- Replace the hand-maintained `KNOWN_TOPIC_IDS` allow-list with "any chunk id built by `buildStaticChunks()`" (derived at module load), so every current and future owner topic is eligible.
- Keep the existing confidence threshold (`MIN_CONFIDENT_SCORE = 1`) and existing safety layers (menu detour, `stripMonetary`, `hasObviousMoneySignal`) unchanged.
- Keep the existing paragraph formatter, but stop dropping ALL-CAPS header lines that happen to also contain the resort's context words — instead, only drop pure section-title lines (`/^[A-Z0-9 &/\-]+$/`). This keeps replies clean without accidentally deleting real content.

**C. `src/baia/concierge.server.ts` — put Onyx on standby**
- Force `onyxConfigured = false` behind a single feature flag (`ONYX_ENABLED`, default off). Env vars (`ONYX_BASE_URL`, `ONYX_API_KEY`) can stay in place; the block is simply skipped when the flag is off. Flipping the flag back on later re-enables Onyx with zero code changes.
- Order of the guest turn stays: lead → rate guard → deterministic knowledge → (Onyx skipped) → OpenRouter/Ollama enhancer → contact fallback.

**D. No changes to**: UI, styling, admin panel, Onyx client, guardrails, lead capture, prompt, routes, DB, or images. This is a targeted retrieval + allow-list + flag change.

## How I'll verify before handing back

Locally hit the deterministic layer with the exact failing questions from your screenshots and a few more, and confirm each returns a real BAIA answer (not the contact fallback):

- "How do I get there?" → transfers / airport_transfer
- "What rooms do you have?" → accommodations
- "What tours do you offer?" → tour_partners / island_hopping
- "Where is BAIA?" → about (San Vicente, not Port Barton)
- "Menu?" / "What's for breakfast?" → dining / breakfast
- "Do you have WiFi?" → wifi
- "Can I bring my dog?" → pets_events
- "What time is check-in?" → checkin_checkout

Then run `bun run build` to confirm the app still compiles. No publish unless you ask.

## Technical notes

- Files touched: `src/baia/concierge.retrieve.ts`, `src/baia/concierge.answer.ts`, `src/baia/concierge.server.ts`. Nothing else.
- `ONYX_ENABLED` is read as `process.env.ONYX_ENABLED === "true"`; unset = off (standby). No secret rotation, no key changes.
- Existing tests in `src/baia/__tests__/concierge.guardrails.test.ts` continue to apply — money/rate refusal behavior is unchanged.
