-- Chapters of a Life: organiser accounts
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
--
-- Creates two tables, both protected by Row Level Security (RLS):
--   profiles: one row per organiser (their name)
--   books:    the books each organiser starts (empty for now)
-- With RLS on, the database itself checks every request: a signed-in
-- organiser can only ever see or change their own rows, and visitors who
-- are not signed in can't see anything.


-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Organisers can view their own profile" on public.profiles;
create policy "Organisers can view their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Organisers can update their own profile" on public.profiles;
create policy "Organisers can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Create a profile automatically whenever someone signs up,
-- using the name they typed on the sign-up form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------------------------------------------------------------------------
-- Books
-- ---------------------------------------------------------------------------

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  loved_one_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists books_organiser_id_idx on public.books (organiser_id);

alter table public.books enable row level security;

drop policy if exists "Organisers can view their own books" on public.books;
create policy "Organisers can view their own books"
  on public.books for select
  to authenticated
  using ((select auth.uid()) = organiser_id);

drop policy if exists "Organisers can create their own books" on public.books;
create policy "Organisers can create their own books"
  on public.books for insert
  to authenticated
  with check ((select auth.uid()) = organiser_id);

drop policy if exists "Organisers can update their own books" on public.books;
create policy "Organisers can update their own books"
  on public.books for update
  to authenticated
  using ((select auth.uid()) = organiser_id)
  with check ((select auth.uid()) = organiser_id);

drop policy if exists "Organisers can delete their own books" on public.books;
create policy "Organisers can delete their own books"
  on public.books for delete
  to authenticated
  using ((select auth.uid()) = organiser_id);
