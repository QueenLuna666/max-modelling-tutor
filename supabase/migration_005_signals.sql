-- MAX — migration 005: signals from the research team's hint guidelines (14.10.2026).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run more than once.
-- signals = { request_type, response_to_last_hint, frustration_stated, basic_meaning_missing, ready_to_finish, choice_after_offer }
alter table annotations add column if not exists signals jsonb;
