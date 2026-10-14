-- MAX — migration 006: student names/hiding, adjustable limits, usage log (14.10.2026).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run more than once.
alter table students add column if not exists display_name text;                 -- a name staff can set for reports
alter table students add column if not exists excluded boolean not null default false; -- hidden from results and analyses
create table if not exists app_settings (key text primary key, value jsonb not null);    -- e.g. key 'limits'
alter table app_settings enable row level security;
create table if not exists usage_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,          -- tutor | analyzer | studio | summary | research | student_chat
  model text,
  input_tokens int, output_tokens int, cache_read_tokens int, cache_write_tokens int,
  session_id uuid, staff_id uuid
);
alter table usage_log enable row level security;
create index if not exists usage_log_at_idx on usage_log (at);
