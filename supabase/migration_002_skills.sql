-- Run once in Supabase → SQL Editor if you created the tables before 13.10 evening.
-- Adds the skill codes the analyzer records for each student message.
alter table annotations add column if not exists skills text[];
