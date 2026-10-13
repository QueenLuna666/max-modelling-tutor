-- MAX — Supabase schema (v3: staff accounts, gender, lab framework codes)
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- All reads and writes go through our Next.js API routes with the service-role key,
-- so RLS is on with no policies: the public (anon) key can't read anything.

create extension if not exists "pgcrypto";

-- Staff accounts: teachers and researchers (and an admin who creates accounts).
-- Passwords are hashed (scrypt) by the app; nothing here is readable from the browser.
create table if not exists staff (
  id             uuid primary key default gen_random_uuid(),
  email          text unique not null,       -- stored lower-case
  name           text not null,
  role           text not null check (role in ('teacher', 'researcher', 'admin')),
  password_hash  text not null,
  created_at     timestamptz not null default now()
);

-- A class the teacher opens; students log in with its code.
create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,          -- e.g. DEMO1 (stored upper-case)
  name        text,
  teacher_id  uuid references staff(id) on delete set null,  -- teacher who owns it
  created_at  timestamptz not null default now()
);

-- A student = nickname inside a class. No real names (minors).
create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes(id) on delete cascade,
  nickname    text not null,
  created_at  timestamptz not null default now(),
  unique (class_id, nickname)
);

-- One attempt at one task. Holds the tutor's working state.
create table if not exists sessions (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students(id) on delete cascade,
  task_id          text not null,               -- matches tasks/<id>.json
  lang             text not null default 'he',  -- he | ar | en
  gender           text not null default 'male'
                   check (gender in ('male', 'female')),  -- how MAX addresses the student (בן / בת)
  current_phase    text not null,               -- phase id from the task file
  phase_attempts   int  not null default 0,     -- student messages in the current phase
  last_hint_level  text,                        -- none | light | medium | strong
  status           text not null default 'active'
                   check (status in ('active', 'done', 'abandoned')),
  summary          text,                        -- process summary, written at the end (day 3)
  started_at       timestamptz not null default now(),
  ended_at         timestamptz
);

-- Every chat turn, student and tutor.
create table if not exists messages (
  id             bigint generated always as identity primary key,
  session_id     uuid not null references sessions(id) on delete cascade,
  role           text not null check (role in ('student', 'tutor')),
  content        text not null,
  phase          text,          -- phase the session was in when this was sent
  word_count     int,           -- student messages: engagement signal
  response_ms    int,           -- student messages: time since the tutor's last reply
  hint_level     text,          -- tutor messages: none | light | medium | strong
  scaffold_type  text,          -- tutor messages: in_step | transition | motivation
  move           text,          -- tutor messages: challenge | praise | guiding_question | ...
  created_at     timestamptz not null default now()
);

-- The analyzer agent's reading of each student message (day 2).
create table if not exists annotations (
  id               bigint generated always as identity primary key,
  message_id       bigint not null references messages(id) on delete cascade,
  session_id       uuid   not null references sessions(id) on delete cascade,
  phase            text,
  performance      text check (performance in ('high', 'partial', 'low')),
  motivation       text check (motivation in ('high', 'low')),
  challenge        text,          -- difficulty code (D-U1 … D-V5), or null
  skills           text[],        -- skill codes shown (U1 … V8, X-…)
  evidence         text,          -- short quote from the student's message
  asks_for_answer  boolean not null default false,
  phase_complete   boolean not null default false,
  lang             text,
  model            text,
  created_at       timestamptz not null default now()
);

create index if not exists messages_session_idx    on messages (session_id, created_at);
create index if not exists annotations_session_idx on annotations (session_id, created_at);
create index if not exists sessions_student_idx    on sessions (student_id);
create index if not exists students_class_idx      on students (class_id);
create index if not exists classes_teacher_idx     on classes (teacher_id);

alter table staff       enable row level security;
alter table classes     enable row level security;
alter table students    enable row level security;
alter table sessions    enable row level security;
alter table messages    enable row level security;
alter table annotations enable row level security;

-- Demo class for testing and for the judges.
insert into classes (code, name) values ('DEMO1', 'כיתת הדגמה')
on conflict (code) do nothing;
