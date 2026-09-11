-- =============================================================================
-- 004_tala_agent.sql  —  TALA agent operations tables
-- =============================================================================
-- Purpose : Physical-world operations data TALA's admin tools act on, plus the
--           evidence trail for every tool execution (tala_action_log).
-- Status  : PREPARED, NOT EXECUTED. Paste into the Lovable Cloud / Supabase
--           SQL Editor manually. Fully idempotent — safe to re-run.
-- Resort  : BAIA San Vicente (single-tenant; agent runs server-side with the
--           service-role client behind the ADMIN_PASSKEY gate).
--
-- TALA's guest surface and the deterministic knowledge layer work WITHOUT
-- this file. Applying it unlocks: the action log (evidence trail), the room
-- status board, and the housekeeping task board. All TALA tools fail
-- gracefully when a table is missing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. tala_action_log — every tool TALA executes (evidence trail)
-- -----------------------------------------------------------------------------
create table if not exists public.tala_action_log (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  surface text not null check (surface in ('guest', 'admin')),
  tool text not null,
  status text not null check (status in ('success', 'error')),
  arguments jsonb not null default '{}'::jsonb,
  result_summary text,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_tala_action_log_created on public.tala_action_log (created_at desc);
create index if not exists idx_tala_action_log_session on public.tala_action_log (session_id);

alter table public.tala_action_log enable row level security;
-- Owner-only: the admin console reads via the service-role client (bypasses
-- RLS after the passkey gate). No anon/authenticated policies on purpose —
-- the log can contain guest contact details from tool arguments.
drop policy if exists "TALA action log admin only" on public.tala_action_log;

-- -----------------------------------------------------------------------------
-- 2. tala_rooms — physical room status board
-- -----------------------------------------------------------------------------
create table if not exists public.tala_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null default 'standard',
  status text not null default 'available'
    check (status in ('available', 'occupied', 'maintenance', 'cleaning')),
  capacity int default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.tala_rooms (name, type, capacity) values
  ('Comfort Cottage 1', 'cottage', 3),
  ('Comfort Cottage 2', 'cottage', 3),
  ('Comfort Cottage 3', 'cottage', 3),
  ('Deluxe Beachfront Suite', 'suite', 4)
on conflict (name) do nothing;

alter table public.tala_rooms enable row level security;
drop policy if exists "TALA rooms public read" on public.tala_rooms;
create policy "TALA rooms public read" on public.tala_rooms
  for select to anon, authenticated using (true);
-- Writes go through the service-role client (admin passkey gate).

-- -----------------------------------------------------------------------------
-- 3. tala_tasks — housekeeping / maintenance task board
-- -----------------------------------------------------------------------------
create table if not exists public.tala_tasks (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  task_type text not null check (task_type in ('cleaning', 'maintenance', 'restock', 'inspection', 'other')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  notes text,
  assigned_to text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_tala_tasks_status on public.tala_tasks (status);

alter table public.tala_tasks enable row level security;
drop policy if exists "TALA tasks public read" on public.tala_tasks;
create policy "TALA tasks public read" on public.tala_tasks
  for select to anon, authenticated using (true);

-- -----------------------------------------------------------------------------
-- 4. tala_events — resort events board (future tool surface)
-- -----------------------------------------------------------------------------
create table if not exists public.tala_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  event_time time,
  location text,
  max_guests int,
  created_at timestamptz not null default now()
);
create index if not exists idx_tala_events_date on public.tala_events (event_date);

alter table public.tala_events enable row level security;
drop policy if exists "TALA events public read" on public.tala_events;
create policy "TALA events public read" on public.tala_events
  for select to anon, authenticated using (true);
