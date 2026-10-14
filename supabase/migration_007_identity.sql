-- MAX — migration 007: students identify with first name, last name and phone (14.10.2026).
-- The phone number is the student's identity inside a class: the same phone = the same student.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run more than once.
alter table students add column if not exists first_name text;
alter table students add column if not exists last_name text;
alter table students add column if not exists phone text;                -- digits only, e.g. 0521234567
-- Two students may share a full name; the phone tells them apart.
alter table students drop constraint if exists students_class_id_nickname_key;
create unique index if not exists students_class_phone_idx on students (class_id, phone) where phone is not null;
