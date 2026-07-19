-- =============================================================================
-- 002_agent_runtime.sql  —  MerQato Resort Agent autonomous runtime state
-- =============================================================================
-- Purpose : Adds the persistent runtime entities that let the reusable Resort
--           Agent maintain an active business goal across many cycles, pause for
--           approval, schedule future work, and verify outcomes.
-- Depends: 001_resorts_and_operations.sql (resorts, guest_conversations,
--           guest_messages, booking_leads, rate_requests, approval_requests,
--           follow_ups, activity_log) must already exist.
-- Status  : PREPARED, NOT EXECUTED. The owner pastes this into the
--           Lovable.dev Supabase SQL Editor manually. Do NOT run via CLI.
-- Resort   : multi-tenant via resort_id; first resort = 'baia-san-vicente'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. agent_goals — the persistent business objective
-- -----------------------------------------------------------------------------
create table if not exists public.agent_goals (
  id text primary key,
  resort_id text not null references public.resorts (id) on delete cascade,
  conversation_id text,
  lead_id text,
  goal_type text not null
    check (goal_type in (
      'qualify_booking_inquiry','obtain_current_rate','confirm_current_availability',
      'resolve_guest_service_request','handle_complaint','follow_up_lead',
      'complete_human_handoff')),
  objective text not null,
  status text not null default 'active'
    check (status in (
      'active','waiting_for_guest','waiting_for_approval','waiting_for_time',
      'blocked','completed','lost','escalated','cancelled')),
  success_criteria jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  current_step text,
  next_review_at timestamptz,
  cycle_count integer not null default 0,
  last_processed_at timestamptz,
  stale_at timestamptz,
  approved_actions jsonb default '[]'::jsonb,   -- scope-bound approval keys
  state jsonb default '{}'::jsonb,               -- collected structured details
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_agent_goals_resort on public.agent_goals (resort_id);
create index if not exists idx_agent_goals_conv on public.agent_goals (conversation_id);
create index if not exists idx_agent_goals_lead on public.agent_goals (lead_id);
create index if not exists idx_agent_goals_status on public.agent_goals (resort_id, status);
create index if not exists idx_agent_goals_stale on public.agent_goals (resort_id, stale_at);

-- -----------------------------------------------------------------------------
-- 2. agent_events — event-driven triggers (idempotent by idempotency_key)
-- -----------------------------------------------------------------------------
create table if not exists public.agent_events (
  id text primary key,
  resort_id text not null references public.resorts (id) on delete cascade,
  goal_id text references public.agent_goals (id) on delete cascade,
  conversation_id text,
  lead_id text,
  type text not null
    check (type in (
      'guest_message_received','admin_message_received','approval_granted',
      'approval_rejected','follow_up_due','lead_stale','action_succeeded',
      'action_failed','booking_confirmed','booking_declined','guest_unresponsive',
      'manual_resume','goal_cancelled')),
  payload jsonb not null default '{}'::jsonb,
  source text not null check (source in ('guest','admin','system','scheduler')),
  idempotency_key text not null,
  processing_status text not null default 'pending'
    check (processing_status in ('pending','processing','processed','skipped','failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_agent_events_resort on public.agent_events (resort_id);
create index if not exists idx_agent_events_goal on public.agent_events (goal_id);
create index if not exists idx_agent_events_idem on public.agent_events (resort_id, idempotency_key);
create unique index if not exists uq_agent_events_idem on public.agent_events (resort_id, idempotency_key);
create index if not exists idx_agent_events_status on public.agent_events (resort_id, processing_status);

-- -----------------------------------------------------------------------------
-- 3. agent_runs — a processing session across one or more cycles
-- -----------------------------------------------------------------------------
create table if not exists public.agent_runs (
  id text primary key,
  resort_id text not null references public.resorts (id) on delete cascade,
  goal_id text references public.agent_goals (id) on delete cascade,
  cycles jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_agent_runs_goal on public.agent_runs (goal_id);

-- -----------------------------------------------------------------------------
-- 4. agent_cycles — one observe/decide/act/verify pass
-- -----------------------------------------------------------------------------
create table if not exists public.agent_cycles (
  id text primary key,
  resort_id text not null references public.resorts (id) on delete cascade,
  goal_id text not null references public.agent_goals (id) on delete cascade,
  run_id text references public.agent_runs (id) on delete cascade,
  trigger_event_id text,
  goal_snapshot jsonb not null,
  knowledge_used jsonb,
  plan jsonb not null,
  actions_attempted jsonb not null default '[]'::jsonb,
  actions_completed jsonb not null default '[]'::jsonb,
  approval_requests_created jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  verification_result jsonb,
  next_scheduled_event_id text,
  status text not null default 'running'
    check (status in ('running','waiting','completed','failed','blocked')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_agent_cycles_goal on public.agent_cycles (goal_id);
create index if not exists idx_agent_cycles_run on public.agent_cycles (run_id);

-- -----------------------------------------------------------------------------
-- 5. agent_actions — executed (or attempted) tool results
-- -----------------------------------------------------------------------------
create table if not exists public.agent_actions (
  id text primary key,
  resort_id text not null references public.resorts (id) on delete cascade,
  goal_id text not null references public.agent_goals (id) on delete cascade,
  cycle_id text references public.agent_cycles (id) on delete cascade,
  tool_name text not null,
  status text not null
    check (status in ('succeeded','failed','pending_approval','deferred')),
  output jsonb,
  error text,
  evidence jsonb,
  retryable boolean not null default false,
  attempt integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_actions_goal on public.agent_actions (goal_id);
create index if not exists idx_agent_actions_cycle on public.agent_actions (cycle_id);

-- -----------------------------------------------------------------------------
-- 6. scheduled_agent_events — the deterministic scheduler queue
-- -----------------------------------------------------------------------------
create table if not exists public.scheduled_agent_events (
  id text primary key,
  resort_id text not null references public.resorts (id) on delete cascade,
  goal_id text references public.agent_goals (id) on delete cascade,
  lead_id text,
  event_type text not null
    check (event_type in (
      'follow_up_due','lead_stale','approval_expired','guest_unresponsive',
      'goal_review','retry')),
  payload jsonb not null default '{}'::jsonb,
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  cancelled boolean not null default false
);
create index if not exists idx_sched_resort on public.scheduled_agent_events (resort_id);
create index if not exists idx_sched_goal on public.scheduled_agent_events (goal_id);
create index if not exists idx_sched_due on public.scheduled_agent_events (resort_id, due_at) where (not cancelled);

-- -----------------------------------------------------------------------------
-- 7. Row Level Security — anon denied; admin via has_role
-- -----------------------------------------------------------------------------
alter table public.agent_goals enable row level security;
alter table public.agent_events enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_cycles enable row level security;
alter table public.agent_actions enable row level security;
alter table public.scheduled_agent_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'agent_goals' and policyname = 'agent_goals_admin'
  ) then
    create policy agent_goals_admin on public.agent_goals
      for all to authenticated
      using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'agent_events' and policyname = 'agent_events_admin'
  ) then
    create policy agent_events_admin on public.agent_events
      for all to authenticated
      using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'agent_runs' and policyname = 'agent_runs_admin'
  ) then
    create policy agent_runs_admin on public.agent_runs
      for all to authenticated
      using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'agent_cycles' and policyname = 'agent_cycles_admin'
  ) then
    create policy agent_cycles_admin on public.agent_cycles
      for all to authenticated
      using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'agent_actions' and policyname = 'agent_actions_admin'
  ) then
    create policy agent_actions_admin on public.agent_actions
      for all to authenticated
      using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'scheduled_agent_events' and policyname = 'scheduled_admin'
  ) then
    create policy scheduled_admin on public.scheduled_agent_events
      for all to authenticated
      using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
end $$;

-- The agent writes through the SERVER-ONLY service role (bypasses RLS).
-- Anon must NEVER directly insert/select these tables.

-- -----------------------------------------------------------------------------
-- 8. Verification queries (run AFTER paste; expect the counts below)
-- -----------------------------------------------------------------------------
-- select count(*) from information_schema.tables
--   where table_name in
--   ('agent_goals','agent_events','agent_runs','agent_cycles','agent_actions','scheduled_agent_events');
--   -- expect: 6
--
-- select count(*) from public.resorts;
--   -- expect: 0  (resorts inserted by owner/admin, not this script)
--
-- select table_name from information_schema.tables
--   where table_name like 'agent_%' or table_name like 'scheduled_%'
--   order by table_name;
--   -- expect: agent_actions, agent_cycles, agent_events, agent_goals,
--   --          agent_runs, scheduled_agent_events

-- -----------------------------------------------------------------------------
-- 9. Rollback (only if the owner chooses to undo)
-- -----------------------------------------------------------------------------
-- drop policy if exists scheduled_admin on public.scheduled_agent_events;
-- drop policy if exists agent_actions_admin on public.agent_actions;
-- drop policy if exists agent_cycles_admin on public.agent_cycles;
-- drop policy if exists agent_runs_admin on public.agent_runs;
-- drop policy if exists agent_events_admin on public.agent_events;
-- drop policy if exists agent_goals_admin on public.agent_goals;
--
-- drop table if exists public.scheduled_agent_events;
-- drop table if exists public.agent_actions;
-- drop table if exists public.agent_cycles;
-- drop table if exists public.agent_runs;
-- drop table if exists public.agent_events;
-- drop table if exists public.agent_goals;
