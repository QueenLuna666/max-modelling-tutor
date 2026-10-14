-- MAX — migration 003: task studio + per-class settings.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run more than once.

-- Tasks written in the studio (from a photo or a short description) live here, not in the code.
-- data = the full task (same shape as tasks/speedometer.json). A row with id 'speedometer'
-- overrides the built-in task, so researchers can edit it too.
create table if not exists tasks (
  id          text primary key,
  status      text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  data        jsonb not null,
  source      jsonb,              -- what the task was built from + the conversation with the task agent
  created_by  uuid references staff(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table tasks enable row level security;

-- Per-class settings, switched on and off by the teacher without code:
-- { "tasks": ["speedometer", ...] | null (= all published),
--   "features": { "readAloud": true, "voiceInput": true, "simpler": true, "bigText": true },
--   "maxHint": "strong" | "medium" | "light" }
alter table classes add column if not exists settings jsonb not null default '{}'::jsonb;
