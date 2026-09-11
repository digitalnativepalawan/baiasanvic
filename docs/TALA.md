# TALA — BAIA's Agent

**TALA** is the resort's in-app AI agent. One brain, two surfaces:

| Surface | Who | Entry point | Tools |
|---|---|---|---|
| **Guest** | Public site visitors | `ConciergeWidget` / `TalaVoiceWidget` → `conciergeChat` → `runGuestTurn` | Read-only lookups + lead capture |
| **Admin** | The owner (passkey-gated) | `TalaConsole` (admin panel → *TALA Agent* tab) → `talaChat({surface:"admin"})` → `runAdminTurn` | Everything above **plus writes**: site content, knowledge, bookings, rooms, tasks |

## Architecture

```
src/baia/tala/
├── agent/
│   ├── tala.loop.ts     The brain. runAgentLoop (observe → tools → answer),
│   │                    runGuestTurn (layered guest pipeline),
│   │                    runAdminTurn (passkey-gated owner turn).
│   ├── tala.tools.ts    Tool registry — 15 real tools over live data,
│   │                    surface-checked, size-capped, price-scrubbed.
│   ├── tala.llm.ts      Provider dispatch with tool calling
│   │                    (OpenRouter / Ollama), model-fn injectable for tests.
│   ├── tala.prompts.ts  System prompts for both surfaces. Shares the
│   │                    HARD_RULES_BLOCK with the legacy concierge prompt.
│   └── tala.actions.ts  Evidence trail — every tool execution written to
│                        tala_action_log (fail-safe when SQL not applied).
├── tala.server.ts       Server fns: talaChat (both surfaces), getTalaStatus,
│                        getTalaActionLog.
├── tala.types.ts        Wire types.
├── TalaVoiceWidget.tsx  Voice UI — browser Web Speech APIs + the same brain.
└── index.ts             Barrel exports.
```

## The guest pipeline (order matters)

`runGuestTurn` — inherited from the battle-tested concierge design:

1. **Qualified-lead detection** — deterministic regex extraction; saves the lead
   with an idempotency key (`ops/guest-lead.server.ts`). No LLM involved.
2. **Price guardrail** — rate questions get the approved no-pricing response.
   Never sent to a model.
3. **Deterministic knowledge** — `answerKnownTopic` answers approved topics
   from static + admin-authored knowledge. No LLM involved.
4. **Onyx** (optional) — only when `ONYX_ENABLED=true` and configured.
5. **TALA agentic loop** — model + tools. Retrieval builds the knowledge
   block; the model may call guest tools (`search_knowledge`, `list_rooms`,
   `list_experiences`, `get_site_info`, `create_booking_lead`); replies pass
   `sanitizeReply` (monetary guardrail) before the guest sees them.
6. **Contact fallback** — guests always land on a real path forward.

**Design principle:** TALA works with zero providers configured. The
deterministic layers (1–3) cover every approved topic on their own; the
agentic loop is a quality enhancer that never decides whether TALA works.

## The agentic loop

`runAgentLoop` runs up to `maxSteps` (6 guest / 8 admin) model calls and
`maxToolCalls` (12/16) tool executions per turn:

- The model sees OpenAI-format tool schemas each step.
- `tool_calls` are executed through `executeTool()` — the single choke point
  for surface checks, JSON argument parsing, size caps, and the action log —
  then fed back as `tool` messages.
- The first content-only model turn ends the loop with that reply.
- Every execution returns evidence chips the UI renders under the reply.

## Security model

- **Guest surface:** tools are read-only + `create_booking_lead`. All tool
  output is passed through `guestSafe()` (drops `price|cost|rate|total|fee|deposit`
  keys, `stripMonetary` on strings) **before** the model sees it. Replies are
  sanitized again post-model. Three independent layers, same as always.
- **Admin surface:** `verifyAdminPasskey` runs **before** any tool is
  reachable; admin tools additionally re-assert the surface inside their
  executors. Writes go through the service-role Supabase client, server-side
  only. The action log is passkey-gated (tool arguments can contain guest
  emails).
- **Provider keys** never leave the server. The admin console only ever
  receives booleans/enums from `getTalaStatus`.

## Setup

1. **Provider (for the agentic loop):** Admin panel → *AI Concierge* →
   enable + set an OpenRouter key or Ollama model. Without it, TALA still
   answers guests deterministically.
2. **Operations tables (optional but recommended):** paste
   `supabase/manual_sql/004_tala_agent.sql` into the Supabase SQL editor.
   Unlocks the action trail, room status board, and task board. All tools
   fail gracefully without it.
3. **Admin passkey:** `ADMIN_PASSKEY` env var — already used by the admin
   panel; TALA's admin surface reuses it.

## Tests

```
npm test        # unit: agent loop, tool registry, guardrails, guest turns (no DB/provider)
npm run test:rls  # live integration: booking_inquiries RLS (needs .env, run after migrations)
```

## What was removed (2026-09 cleanup)

- `services/hermes/` — 30 MB vendored Python agent framework that could only
  run on one local Windows machine; the localhost:8100 proxy returned empty
  replies everywhere else. Preserved in git history.
- `WorkforcePanel.tsx` — the admin tab that rendered hardcoded mock jobs,
  stats, and approvals. Replaced by `TalaConsole`.
- `tala.client.ts` — browser-side fetch to `localhost:8100` (could never work
  deployed).
- `TalaVoiceWidget`'s dependency on the non-existent `/api/tala/voice` route —
  now uses browser Web Speech APIs + the in-app brain.
- 20 one-off Windows-path debugging scripts and `proof/` harnesses.
