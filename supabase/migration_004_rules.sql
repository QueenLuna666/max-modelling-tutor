-- MAX — migration 004: the research team's identification rules (14.10.2026).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run more than once.
alter table annotations add column if not exists level text;            -- strong | intermediate | significant_difficulty | insufficient_evidence (main phase)
alter table annotations add column if not exists student_pattern text;  -- the student's overall pattern so far (same scale)
alter table annotations add column if not exists phases jsonb;          -- every phase seen in the message: [{phase, level, aspect, skills, evidence, after_support}]
