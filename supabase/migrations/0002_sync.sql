-- Cloud save, per user. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Every table has row level security: a signed-in user can only ever see and change their own rows.
-- Size limits keep one account from filling the database.

-- 1. Settings and progress (calibration, ankle weights, XP, schedule, routines). One row per user.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 300000),
  updated_at timestamptz not null default now()
);

-- 2. Finished sessions.
create table if not exists public.sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,60}$'),
  date date not null,
  payload jsonb not null check (pg_column_size(payload) <= 60000),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists sessions_user_date on public.sessions (user_id, date desc);

-- 3. Recordings of you doing an exercise (body points only, never video), used to tune tracking.
create table if not exists public.training_samples (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,60}$'),
  exercise_id text not null check (exercise_id ~ '^[A-Za-z0-9_-]{1,60}$'),
  expected integer not null check (expected between 0 and 100),
  fps real,
  frames jsonb not null check (pg_column_size(frames) <= 400000),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists samples_user_ex on public.training_samples (user_id, exercise_id);

alter table public.user_settings enable row level security;
alter table public.sessions enable row level security;
alter table public.training_samples enable row level security;
alter table public.user_settings force row level security;
alter table public.sessions force row level security;
alter table public.training_samples force row level security;

do $$
declare t text;
begin
  foreach t in array array['user_settings', 'sessions', 'training_samples'] loop
    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);
    execute format('create policy "own rows select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Row-count caps per user (a friendly guard against runaway uploads).
create or replace function public.cap_rows() returns trigger language plpgsql security invoker set search_path = '' as $$
declare n integer; lim integer := tg_argv[0]::integer;
begin
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name) into n using new.user_id;
  if n >= lim then raise exception 'Too many rows (limit %)', lim; end if;
  return new;
end $$;

drop trigger if exists cap_sessions on public.sessions;
create trigger cap_sessions before insert on public.sessions for each row execute function public.cap_rows(5000);
drop trigger if exists cap_samples on public.training_samples;
create trigger cap_samples before insert on public.training_samples for each row execute function public.cap_rows(300);
