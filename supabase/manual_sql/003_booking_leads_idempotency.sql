-- =============================================================================
-- 003_booking_leads_idempotency.sql
-- Purpose: Add idempotency support to public.booking_leads so the Onyx
--          create_guest_lead tool (via BAIA's /api/ops/guest-lead endpoint)
--          can safely retry without creating duplicate leads.
--
-- This is ADDITIVE and idempotent. It does NOT modify 001 or any existing data.
-- Apply AFTER 001_resorts_and_operations.sql.
--
-- Adds:
--   * column  booking_leads.idempotency_key text
--   * partial unique index on (resort_id, idempotency_key) when key is not null
--
-- Absolute pricing rule note: no monetary columns are added or changed here.
-- =============================================================================

-- 1. Add the idempotency_key column (nullable; existing rows unaffected).
alter table public.booking_leads
  add column if not exists idempotency_key text;

-- 2. Enforce idempotency per resort. Partial unique index so legacy rows with a
--    NULL key are never blocked; only non-null keys must be unique per resort.
create unique index if not exists uq_booking_leads_resort_idem
  on public.booking_leads (resort_id, idempotency_key)
  where idempotency_key is not null;

-- =============================================================================
-- VERIFICATION (run these after applying; each should succeed).
-- The functional idempotency check is wrapped in a DO block that expects the
-- unique_violation, proves the second insert is rejected, and guarantees the
-- temporary row is cleaned up. It leaves NO test row behind.
-- =============================================================================

-- Confirm the column exists:
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'booking_leads'
  and column_name = 'idempotency_key';

-- Confirm the unique index exists:
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'booking_leads'
  and indexname = 'uq_booking_leads_resort_idem';

-- Functional idempotency check (no leftover row; expected unique_violation caught):
do $$
declare
  v_id uuid;
begin
  insert into public.booking_leads (resort_id, idempotency_key, channel, status)
    values ('baia-san-vicente', 'verify-idem-001', 'website', 'new')
    returning id into v_id;

  begin
    insert into public.booking_leads (resort_id, idempotency_key, channel, status)
      values ('baia-san-vicente', 'verify-idem-001', 'website', 'new');
    -- If we reach here, the constraint did NOT fire -> fail loudly.
    raise exception 'IDEMPOTENCY FAILED: duplicate insert was allowed';
  exception
    when unique_violation then
      -- Expected: the second insert was correctly rejected.
      raise notice 'IDEMPOTENCY OK: duplicate insert rejected (unique_violation)';
  end;

  -- Guaranteed cleanup of the temporary probe row.
  delete from public.booking_leads where id = v_id;
end $$;
