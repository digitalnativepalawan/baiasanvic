-- ============================================================================
-- BAIA Resort Operations — Version 1 schema (manual SQL for Lovable.dev)
-- File: supabase/manual_sql/001_resorts_and_operations.sql
-- Run in: Lovable.dev -> Supabase SQL editor (Dashboard -> SQL -> New query)
-- DO NOT run via Supabase CLI. Do not execute automatically.
--
-- Governing rules applied:
--  * Multi-resort boundary via resorts.resort_id (first: 'baia-san-vicente')
--  * Server-only writes for operational tables (service_role)
--  * Admin access via Supabase auth + user_roles / has_role('admin')
--  * NO monetary fields populated by AI; prices owner-entered + verified
--  * Idempotency handled in 003 (booking_leads.idempotency_key)
--
-- This script is ADDITIVE and IDEMPOTENT:
--  * Tables/types use IF NOT EXISTS or catalog-guarded DO blocks
--  * Policies use DROP POLICY IF EXISTS + CREATE POLICY
--  * Resort seed uses ON CONFLICT DO NOTHING (never overwrites owner data)
--  * Nothing is dropped or truncated
--
-- EXECUTION-ORDER INVARIANTS (static audit passed):
--  * has_role()        created in §1b, BEFORE any policy/grant/use of it
--  * conv_channel /
--    lead_status enums created in §2, BEFORE tables that use them (§3-§12)
--  * all 13 tables created in §1-§12, BEFORE RLS policies (§13),
--    triggers (§14), and grants (§15)
--  * touch_updated_at() created in §14, BEFORE its GRANT EXECUTE in §15
--  * every trigger references a function created in the same §14 block
--  * every policy references has_role() (created §1b)
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Stable resort boundary
-- ---------------------------------------------------------------------------
create table if not exists public.resorts (
  id text primary key,
  name text not null,
  location text,
  timezone text not null default 'Asia/Manila',
  default_currency text not null default 'PHP',
  languages jsonb not null default '["English","Filipino"]'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  booking_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed ONLY verified stable identity fields. Never seed unverified emails or
-- generic Booking.com/Agoda/Airbnb homepage URLs. ON CONFLICT DO NOTHING so a
-- rerun never overwrites owner-managed resort data.
insert into public.resorts (id, name, location)
values ('baia-san-vicente', 'BAIA San Vicente', 'San Vicente, Palawan, Philippines')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 1b. Admin role support (required by RLS policies: public.has_role(...))
--     Created BEFORE §13 policies that reference it.
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Hardened: fully-qualified objects, safe search_path, SECURITY DEFINER so the
-- function (used inside RLS) can read user_roles while direct user access is
-- denied by RLS. Execute is revoked from anon/public and granted only to
-- authenticated (RLS eval) + service_role (see grants in §15).
create or replace function public.has_role(p_user uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = p_user and role = p_role
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Enum types (catalog-guarded DO blocks: CREATE TYPE has no IF NOT EXISTS)
--    Created BEFORE the tables in §3-§12 that use them.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'conv_channel' and n.nspname = 'public'
  ) then
    create type public.conv_channel as enum ('website','whatsapp','telegram','email','manual');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'lead_status' and n.nspname = 'public'
  ) then
    create type public.lead_status as enum (
      'new','qualifying','qualified','awaiting_owner','quote_draft','quote_sent',
      'follow_up_due','booked','lost','closed'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Guest conversations (canonical) — one per external session
-- ---------------------------------------------------------------------------
create table if not exists public.guest_conversations (
  id uuid primary key default gen_random_uuid(),
  resort_id text not null references public.resorts(id) on delete cascade,
  channel public.conv_channel not null default 'website',
  external_session_id text not null,
  guest_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resort_id, external_session_id)
);

create index if not exists idx_guest_conversations_resort
  on public.guest_conversations(resort_id);
create index if not exists idx_guest_conversations_ext
  on public.guest_conversations(resort_id, external_session_id);

-- ---------------------------------------------------------------------------
-- 4. Guest messages (canonical)
-- ---------------------------------------------------------------------------
create table if not exists public.guest_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.guest_conversations(id) on delete cascade,
  resort_id text not null references public.resorts(id) on delete cascade,
  role text not null check (role in ('guest','agent')),
  content text not null,
  msg_external_id text,
  created_at timestamptz not null default now(),
  unique (conversation_id, msg_external_id)
);

create index if not exists idx_guest_messages_conv
  on public.guest_messages(conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. Booking leads (structured)
-- ---------------------------------------------------------------------------
create table if not exists public.booking_leads (
  id uuid primary key default gen_random_uuid(),
  resort_id text not null references public.resorts(id) on delete cascade,
  conversation_id uuid references public.guest_conversations(id) on delete set null,
  channel public.conv_channel not null default 'website',
  guest_name text,
  email text,
  phone text,
  check_in date,
  check_out date,
  guest_count integer,
  children_count integer,
  room_preference text,
  budget_range text,
  transport_needed boolean,
  special_occasion text,
  notes text,
  status public.lead_status not null default 'new',
  estimated_value numeric,            -- owner-entered only; never AI
  currency text,                       -- owner-only context; never guest-fed
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_booking_leads_resort on public.booking_leads(resort_id);
create index if not exists idx_booking_leads_conv on public.booking_leads(conversation_id);
create index if not exists idx_booking_leads_status on public.booking_leads(status);

-- ---------------------------------------------------------------------------
-- 6. Lead status history
-- ---------------------------------------------------------------------------
create table if not exists public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.booking_leads(id) on delete cascade,
  from_status public.lead_status,
  to_status public.lead_status not null,
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_status_history_lead
  on public.lead_status_history(lead_id, created_at);

-- ---------------------------------------------------------------------------
-- 7. Rate requests (AI collects, owner prices)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.booking_leads(id) on delete set null,
  resort_id text not null references public.resorts(id) on delete cascade,
  guest_name text,
  check_in date,
  check_out date,
  adults integer,
  children integer,
  room_preference text,
  transfer_required boolean,
  special_requests text,
  contact_details text,
  preferred_platform text,
  owner_notes text,
  status text not null default 'pending'
    check (status in ('pending','answered','expired')),
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_requests_resort on public.rate_requests(resort_id);
create index if not exists idx_rate_requests_lead on public.rate_requests(lead_id);

-- ---------------------------------------------------------------------------
-- 8. Quotes (OWNER-ENTERED monetary records only; AI cannot populate)
-- ---------------------------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.booking_leads(id) on delete set null,
  resort_id text not null references public.resorts(id) on delete cascade,
  entered_by uuid references auth.users(id),
  entered_at timestamptz not null default now(),
  price_source text,
  valid_until timestamptz,
  owner_verified boolean not null default true,
  is_expired boolean not null default false,
  guest_message text,
  status text not null default 'draft'
    check (status in ('draft','sent','expired')),
  created_at timestamptz not null default now()
);

create index if not exists idx_quotes_resort on public.quotes(resort_id);
create index if not exists idx_quotes_lead on public.quotes(lead_id);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  label text not null,
  amount numeric,
  kind text
);

-- ---------------------------------------------------------------------------
-- 9. Approval queue
-- ---------------------------------------------------------------------------
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  resort_id text not null references public.resorts(id) on delete cascade,
  lead_id uuid references public.booking_leads(id) on delete set null,
  conversation_id uuid references public.guest_conversations(id) on delete set null,
  action_type text not null
    check (action_type in ('draft_reply','rate_request','proposed_discount',
      'proposed_transfer','proposed_booking_confirmation','follow_up')),
  draft_content text,
  verified_facts jsonb not null default '{}'::jsonb,
  missing_info jsonb not null default '{}'::jsonb,
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','edited')),
  created_at timestamptz not null default now()
);

create index if not exists idx_approval_resort on public.approval_requests(resort_id);
create index if not exists idx_approval_status on public.approval_requests(status);

-- ---------------------------------------------------------------------------
-- 10. Follow-ups
-- ---------------------------------------------------------------------------
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.booking_leads(id) on delete cascade,
  resort_id text not null references public.resorts(id) on delete cascade,
  due_at timestamptz,
  status text not null default 'due' check (status in ('due','overdue','completed')),
  draft_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_followups_due on public.follow_ups(due_at);
create index if not exists idx_followups_resort on public.follow_ups(resort_id);

-- ---------------------------------------------------------------------------
-- 11. Resort knowledge (NON-MONETARY categories only; monetary excluded)
-- ---------------------------------------------------------------------------
create table if not exists public.resort_knowledge (
  id uuid primary key default gen_random_uuid(),
  resort_id text not null references public.resorts(id) on delete cascade,
  category text not null,
  content jsonb not null default '{}'::jsonb,
  source text,
  source_status text,
  owner_verified boolean not null default false,
  verified_at timestamptz,
  verified_by text,
  effective_from timestamptz,
  effective_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_resort_knowledge_resort on public.resort_knowledge(resort_id);

-- Allow only ONE active record per (resort_id, category); multiple inactive
-- historical versions are permitted.
create unique index if not exists uq_resort_knowledge_active
  on public.resort_knowledge (resort_id, category)
  where is_active = true;

-- ---------------------------------------------------------------------------
-- 12. Activity / audit log
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  resort_id text not null references public.resorts(id) on delete cascade,
  actor text,
  action text not null,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_resort on public.activity_log(resort_id);
create index if not exists idx_activity_created on public.activity_log(created_at desc);

-- ---------------------------------------------------------------------------
-- 13. Row Level Security (enabled on EVERY public table)
--     anon: NO access to operational data (resorts readable only)
--     authenticated non-admin: denied by admin-only policies
--     service_role: server-only, bypasses RLS (explicit grants in §15)
--     Policies reference has_role() which was created in §1b.
-- ---------------------------------------------------------------------------

-- resorts: public readable directory
alter table public.resorts enable row level security;
drop policy if exists "Public can read resort directory" on public.resorts;
create policy "Public can read resort directory"
  on public.resorts for select to anon, authenticated using (true);

-- user_roles: NO direct user access (privilege-escalation protection).
-- Only service_role (server) may manage role assignments. RLS denies anon &
-- authenticated entirely (no policy). has_role() is SECURITY DEFINER and
-- bypasses RLS, so admin checks still work.
alter table public.user_roles enable row level security;

-- guest_conversations
alter table public.guest_conversations enable row level security;
drop policy if exists "Admins manage conversations" on public.guest_conversations;
create policy "Admins manage conversations"
  on public.guest_conversations for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- guest_messages
alter table public.guest_messages enable row level security;
drop policy if exists "Admins manage messages" on public.guest_messages;
create policy "Admins manage messages"
  on public.guest_messages for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- booking_leads
alter table public.booking_leads enable row level security;
drop policy if exists "Admins manage leads" on public.booking_leads;
create policy "Admins manage leads"
  on public.booking_leads for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- lead_status_history
alter table public.lead_status_history enable row level security;
drop policy if exists "Admins manage lead_status_history" on public.lead_status_history;
create policy "Admins manage lead_status_history"
  on public.lead_status_history for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- rate_requests
alter table public.rate_requests enable row level security;
drop policy if exists "Admins manage rate_requests" on public.rate_requests;
create policy "Admins manage rate_requests"
  on public.rate_requests for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- quotes
alter table public.quotes enable row level security;
drop policy if exists "Admins manage quotes" on public.quotes;
create policy "Admins manage quotes"
  on public.quotes for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- quote_items
alter table public.quote_items enable row level security;
drop policy if exists "Admins manage quote_items" on public.quote_items;
create policy "Admins manage quote_items"
  on public.quote_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- approval_requests
alter table public.approval_requests enable row level security;
drop policy if exists "Admins manage approvals" on public.approval_requests;
create policy "Admins manage approvals"
  on public.approval_requests for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- follow_ups
alter table public.follow_ups enable row level security;
drop policy if exists "Admins manage follow_ups" on public.follow_ups;
create policy "Admins manage follow_ups"
  on public.follow_ups for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- resort_knowledge
alter table public.resort_knowledge enable row level security;
drop policy if exists "Admins manage knowledge" on public.resort_knowledge;
create policy "Admins manage knowledge"
  on public.resort_knowledge for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- activity_log
alter table public.activity_log enable row level security;
drop policy if exists "Admins manage activity" on public.activity_log;
create policy "Admins manage activity"
  on public.activity_log for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 14. Trigger function + triggers (MUST exist BEFORE the GRANT EXECUTE in §15)
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger trg_booking_leads_updated
  before update on public.booking_leads
  for each row execute function public.touch_updated_at();
create or replace trigger trg_resort_knowledge_updated
  before update on public.resort_knowledge
  for each row execute function public.touch_updated_at();
create or replace trigger trg_resorts_updated
  before update on public.resorts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 15. Explicit privileges
--     * service_role: explicit full access to objects created by THIS migration
--     * authenticated: table privileges on the 11 operational admin tables
--       (RLS still gates actual row access to admins via has_role)
--     * resorts: select to anon + authenticated (public directory)
--     * user_roles: revoke from anon + authenticated (escalation protection)
--     * has_role(): revoke from anon/public, grant to authenticated + service_role
--     * NO privileges altered on any pre-existing public table
--     * GRANT EXECUTE on touch_updated_at() is valid here because §14 created it
-- ---------------------------------------------------------------------------

-- service_role explicit grants (server-only writes; bypasses RLS)
grant all privileges on public.resorts to service_role;
grant all privileges on public.user_roles to service_role;
grant all privileges on public.guest_conversations to service_role;
grant all privileges on public.guest_messages to service_role;
grant all privileges on public.booking_leads to service_role;
grant all privileges on public.lead_status_history to service_role;
grant all privileges on public.rate_requests to service_role;
grant all privileges on public.quotes to service_role;
grant all privileges on public.quote_items to service_role;
grant all privileges on public.approval_requests to service_role;
grant all privileges on public.follow_ups to service_role;
grant all privileges on public.resort_knowledge to service_role;
grant all privileges on public.activity_log to service_role;
grant execute on function public.has_role(uuid, text) to service_role;
grant execute on function public.touch_updated_at() to service_role;

-- Authenticated ADMIN table privileges.
-- These are REQUIRED because RLS policies alone do not grant PG table privileges.
-- RLS remains enabled, so only authenticated users satisfying
-- public.has_role(auth.uid(), 'admin') can actually access rows.
grant select, insert, update, delete on public.guest_conversations to authenticated;
grant select, insert, update, delete on public.guest_messages to authenticated;
grant select, insert, update, delete on public.booking_leads to authenticated;
grant select, insert, update, delete on public.lead_status_history to authenticated;
grant select, insert, update, delete on public.rate_requests to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_items to authenticated;
grant select, insert, update, delete on public.approval_requests to authenticated;
grant select, insert, update, delete on public.follow_ups to authenticated;
grant select, insert, update, delete on public.resort_knowledge to authenticated;
grant select, insert, update, delete on public.activity_log to authenticated;

-- Public directory read for resorts only
grant select on public.resorts to anon, authenticated;

-- Deny anon from every operational table (explicit)
revoke all on public.user_roles from anon;
revoke all on public.guest_conversations from anon;
revoke all on public.guest_messages from anon;
revoke all on public.booking_leads from anon;
revoke all on public.lead_status_history from anon;
revoke all on public.rate_requests from anon;
revoke all on public.quotes from anon;
revoke all on public.quote_items from anon;
revoke all on public.approval_requests from anon;
revoke all on public.follow_ups from anon;
revoke all on public.resort_knowledge from anon;
revoke all on public.activity_log from anon;

-- user_roles: deny anon AND authenticated (only service_role may manage roles)
revoke all on public.user_roles from anon, authenticated;

-- has_role: not callable by anon/public; callable by authenticated (RLS) + service_role
revoke execute on function public.has_role(uuid, text) from public;
grant execute on function public.has_role(uuid, text) to authenticated, service_role;

commit;
