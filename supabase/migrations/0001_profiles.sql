-- Profiles: one row per signed-in user. Row level security is ON and nobody can read anyone else's row yet.
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 20 and display_name !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- A user can see, create and change only their own row. Nobody can delete it directly (it goes with the account).
drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles for select to authenticated using (id = (select auth.uid()));

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Anonymous visitors get no access at all.
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- Create the row automatically when someone first signs in.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
