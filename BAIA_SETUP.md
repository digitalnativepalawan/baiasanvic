# BAIA — Beachfront Boutique Lodge

Imported from the original Vite/React/Tailwind BAIA site and wired up to
Lovable Cloud (Supabase) for content, admin auth, image storage, and booking
inquiries. The public site, admin panel UI, and placeholder copy/images are
preserved as-is — you can swap them out from the admin panel later.

## What's persisted server-side

All previous `localStorage` usage was replaced with Supabase:

- **`site_state`** — single JSON row storing hero, logo, header, footer, theme,
  gallery, rooms, and activities. Public read; only admins can write.
- **`booking_inquiries`** — every booking submission lands here with
  `status = 'pending'`. Anyone can insert; only admins can read/update/delete.
- **`user_roles`** — links a Supabase user to the `admin` role via
  `has_role(auth.uid(), 'admin')`.
- **`site-assets` storage bucket** — admin image uploads land here and are
  served via public URLs (bucket is private, RLS allows public SELECT).

## Booking flow

The fake card-payment step was removed. The booking modal now goes:
select room → guest details → **Submit Inquiry** → confirmation screen with a
"Pending confirmation" reference. Nothing is charged; the resort follows up by
email to confirm rates and availability.

## Environment variables

Copy `.env.example` to `.env` and fill in your project's values:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable/anon key>
```

On Lovable Cloud these are injected automatically — nothing to configure.

## Creating the first admin

1. Open **Cloud → Users** and create your account (email + password).
2. Copy that user's UID.
3. In **Cloud → SQL editor** run:
   ```sql
   INSERT INTO public.user_roles (user_id, role) VALUES ('<uid>', 'admin');
   ```
4. Reload the site and click the admin toggle (bottom-right corner). Sign in
   with the account you just created; the admin panel unlocks.

Only signed-in admins can edit content, and only their edits are written back
to `site_state`. Anonymous visitors keep the read-only public view.

## TALA — the AI agent (guest chat + backend admin)

TALA is the in-app agent that powers both the guest-facing chat and, behind
the admin passkey, backend operations. Full architecture: `docs/TALA.md`.

**Guest surface** (bottom-right chat bubble): answers from the resort's
knowledge, checks live site data with tools, captures booking inquiries,
never quotes prices.

**Admin surface** (admin panel → *TALA Agent* tab): the same brain with write
tools — edit site content, manage the knowledge base, triage booking
inquiries, update room statuses, create housekeeping tasks. Every tool
execution is recorded in the action trail with evidence.

### Enabling the agentic loop

1. Admin panel → **AI Concierge** → switch on and set a provider:
   an OpenRouter API key (any tool-capable model) or a local Ollama model.
2. Without a provider, TALA still answers guests deterministically from the
   approved knowledge base — the provider only unlocks the agentic
   tool-calling loop and the admin write tools.

### Operations tables (optional, recommended)

Paste `supabase/manual_sql/004_tala_agent.sql` into **Cloud → SQL editor** to
create `tala_action_log` (evidence trail), `tala_rooms` (room status board),
`tala_tasks` (task board), and `tala_events`. All TALA tools degrade
gracefully until this is applied.

### Tests

```bash
npm test          # unit tests — no DB or provider needed
npm run test:rls  # live RLS integration test (needs .env; run after migrations)
```
