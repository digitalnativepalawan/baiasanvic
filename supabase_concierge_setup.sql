-- ============================================================================
-- BAIA AI Concierge — Supabase setup
-- Run this in your Supabase Cloud SQL editor (Dashboard -> SQL -> New query).
-- ============================================================================
-- IMPORTANT: `concierge_config` holds the owner's OpenRouter API key. It is
-- read ONLY by the server (service-role), never exposed to the browser. The
-- public `site_state` table must NOT hold secrets, so we use a separate table.

-- 1) Concierge configuration (provider + key + persona + knowledge) ----------
create table if not exists public.concierge_config (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.concierge_config enable row level security;

-- Server (service role) reads/writes. Deny all from the anon/public browser key.
revoke all on public.concierge_config from anon, authenticated;
-- The service role bypasses RLS, so no policy is needed for server access.
-- Explicitly ensure the public role cannot select/insert/update/delete:
create policy "no_public_access" on public.concierge_config
  for all to anon
  using (false) with check (false);
create policy "no_authenticated_access" on public.concierge_config
  for all to authenticated
  using (false) with check (false);

-- 2) Concierge chat log (guest + agent turns, for owner review) --------------
create table if not exists public.concierge_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text,
  role text not null check (role in ('guest', 'agent')),
  content text not null
);

alter table public.concierge_log enable row level security;

revoke all on public.concierge_log from anon, authenticated;
create policy "no_public_log_access" on public.concierge_log
  for all to anon
  using (false) with check (false);
create policy "no_authenticated_log_access" on public.concierge_log
  for all to authenticated
  using (false) with check (false);

-- To review what guests asked later, run (as the service role / in SQL editor):
--   select session_id, role, content, created_at
--   from public.concierge_log order by created_at desc limit 200;

-- That's it. After running this, set the concierge up from the admin panel:
-- Admin panel -> AI Concierge tab -> choose provider, paste key / pick Ollama,
-- enable, Save.
