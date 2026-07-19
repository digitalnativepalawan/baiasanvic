-- =============================================================================
-- 000_preflight_existing_schema.sql
-- READ-ONLY PREFLIGHT — inspect Lovable.dev Supabase before running FILE 001.
--
-- This script performs NO DDL, DML, grants, revokes, inserts, updates or
-- deletes. It only queries catalog views.
--
-- Run THIS FIRST, alone, in the Lovable.dev Supabase SQL Editor.
-- Paste its exact output back to David's agent. DO NOT run FILE 001 until the
-- preflight output is reviewed and cleared.
-- =============================================================================

-- A. Existing target tables
select 'TABLE' as object_kind, c.relname as object_name, 'present' as status
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in (
    'resorts','user_roles','guest_conversations','guest_messages','booking_leads',
    'lead_status_history','rate_requests','quotes','quote_items','approval_requests',
    'follow_ups','resort_knowledge','activity_log'
  )
order by c.relname;

-- B. Existing enum types
select 'ENUM' as object_kind, t.typname as object_name, 'present' as status
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typtype = 'e'
  and t.typname in ('conv_channel','lead_status')
order by t.typname;

-- C. Existing functions
select 'FUNCTION' as object_kind, p.proname as object_name,
       pg_get_function_identity_arguments(p.oid) as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('has_role','touch_updated_at')
order by p.proname;

-- D. Existing policies on target tables
select 'POLICY' as object_kind,
       pol.tablename || '.' || pol.policyname as object_name,
       pol.roles::text as roles
from pg_policies pol
where pol.schemaname = 'public'
  and pol.tablename in (
    'resorts','user_roles','guest_conversations','guest_messages','booking_leads',
    'lead_status_history','rate_requests','quotes','quote_items','approval_requests',
    'follow_ups','resort_knowledge','activity_log'
  )
order by pol.tablename, pol.policyname;

-- E. Existing indexes with target names
select 'INDEX' as object_kind, i.indexname as object_name, i.tablename
from pg_indexes i
where i.schemaname = 'public'
  and i.indexname in (
    'idx_guest_conversations_resort','idx_guest_conversations_ext',
    'idx_guest_messages_conv','idx_booking_leads_resort','idx_booking_leads_conv',
    'idx_booking_leads_status','idx_lead_status_history_lead','idx_rate_requests_resort',
    'idx_rate_requests_lead','idx_quotes_resort','idx_quotes_lead','idx_approval_resort',
    'idx_approval_status','idx_followups_due','idx_followups_resort',
    'idx_resort_knowledge_resort','idx_activity_resort','idx_activity_created',
    'uq_resort_knowledge_active','uq_booking_leads_resort_idem'
  )
order by i.indexname;

-- F. Existing columns and data types for any target table already present
select 'COLUMN' as object_kind,
       c.table_name || '.' || c.column_name as object_name,
       c.data_type || case
         when c.character_maximum_length is not null
           then '(' || c.character_maximum_length || ')'
         else '' end as detail
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'resorts','user_roles','guest_conversations','guest_messages','booking_leads',
    'lead_status_history','rate_requests','quotes','quote_items','approval_requests',
    'follow_ups','resort_knowledge','activity_log'
  )
order by c.table_name, c.ordinal_position;

-- G. Existing foreign keys for any target table already present
select 'FK' as object_kind,
       tc.constraint_name as object_name,
       kcu.table_name || '.' || kcu.column_name || ' -> ' ||
       ccu.table_name || '.' || ccu.column_name as detail
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.constraint_schema = tc.constraint_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
where tc.constraint_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
  and kcu.table_name in (
    'resorts','user_roles','guest_conversations','guest_messages','booking_leads',
    'lead_status_history','rate_requests','quotes','quote_items','approval_requests',
    'follow_ups','resort_knowledge','activity_log'
  )
order by kcu.table_name, tc.constraint_name;

-- H. Existing grants for anon, authenticated and service_role on target tables
select 'GRANT' as object_kind,
       g.table_name || ' -> ' || g.grantee as object_name,
       g.privilege_type as detail
from information_schema.role_table_grants g
where g.table_schema = 'public'
  and g.grantee in ('anon','authenticated','service_role')
  and g.table_name in (
    'resorts','user_roles','guest_conversations','guest_messages','booking_leads',
    'lead_status_history','rate_requests','quotes','quote_items','approval_requests',
    'follow_ups','resort_knowledge','activity_log'
  )
order by g.table_name, g.grantee, g.privilege_type;
