<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and
> the user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# BAIA — Beachfront Boutique Lodge

TanStack Start (React 19, SSR) + Supabase (Lovable Cloud). Public resort site,
admin panel, and **TALA**, the in-app AI agent that runs both the guest chat
and (behind the admin passkey) backend operations. See `docs/TALA.md` for the
full agent architecture.

Quick orientation:

- `src/baia/` — the app. `App.tsx` composes public sections; `components/`
  holds sections + admin panel; `context/SiteContext.tsx` is the CMS state
  (persisted to the `site_state` Supabase row, writes gated by ADMIN_PASSKEY).
- `src/baia/tala/` — the agent: loop, tools, prompts, LLM dispatch, action log.
- `src/baia/concierge.*.ts` — the guest-chat pipeline TALA runs (guardrails,
  knowledge, retrieval, lead capture). `conciergeChat` is a thin adapter over
  `runGuestTurn`.
- `supabase/manual_sql/` — SQL the owner pastes into the Supabase SQL editor
  (do NOT run via CLI). `004_tala_agent.sql` unlocks TALA's ops tables +
  action log.
- Tests: `npm test` (unit, no DB/provider needed), `npm run test:rls` (live
  integration, needs `.env`). The test loader in `scripts/test-loader.mjs`
  resolves the `@/` alias and extensionless TS imports for plain-node runs.

Hard rules when touching the agent: guests must never be quoted prices
(enforced in `concierge.guardrails.ts`, `concierge.knowledge.ts`, and
`tala/agent/tala.tools.ts` `guestSafe()`), provider keys stay server-side
only, and everything must keep working with zero LLM providers configured.
