-- Chapters of a Life: private admin area
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run the earlier files in supabase/migrations first (you already have).
--
-- What it does:
--   1. Creates a list of admin accounts ("admins"). Nobody can read or change
--      this list through the website, only here in Supabase.
--   2. Adds YOUR account (chaptersofalifeuk@gmail.com) to it. You must have
--      created an account on the website with that email first.
--   3. Adds is_admin(), which the website's server uses to check, on every
--      admin page, that the signed-in person is on the list.
--   4. Adds admin_book_overview(), the list of all books with their counts and
--      organiser details. Only the website's server (secret key) can call it,
--      and only after checking is_admin().
--
-- To add another admin later, run (with their email):
--   insert into public.admins (user_id)
--   select id from auth.users where lower(email) = 'their@email.com'
--   on conflict do nothing;
-- To remove one:
--   delete from public.admins
--   where user_id = (select id from auth.users where lower(email) = 'their@email.com');


-- ---------------------------------------------------------------------------
-- 1. The list of admins
-- ---------------------------------------------------------------------------

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Row Level Security on, with no rules: nobody can see or change this list
-- through the website. It can only be changed here in Supabase.
alter table public.admins enable row level security;
revoke all on table public.admins from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Your account
-- ---------------------------------------------------------------------------

insert into public.admins (user_id)
select id from auth.users where lower(email) = 'chaptersofalifeuk@gmail.com'
on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------------
-- 3. "Is the signed-in person an admin?"
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Every book, with counts and the organiser's details (server only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_book_overview()
returns table (
  book_id uuid,
  full_name text,
  known_as text,
  created_at timestamptz,
  organiser_id uuid,
  organiser_name text,
  organiser_email text,
  memories_waiting integer,
  memories_approved integer,
  memories_hidden integer,
  photos integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.full_name,
    b.known_as,
    b.created_at,
    b.organiser_id,
    p.full_name,
    u.email::text,
    (select count(*) from public.memories m where m.book_id = b.id and m.status = 'waiting')::integer,
    (select count(*) from public.memories m where m.book_id = b.id and m.status = 'approved')::integer,
    (select count(*) from public.memories m where m.book_id = b.id and m.status = 'hidden')::integer,
    (select count(*) from public.memory_photos ph where ph.book_id = b.id and ph.uploaded)::integer
  from public.books b
  left join public.profiles p on p.id = b.organiser_id
  left join auth.users u on u.id = b.organiser_id
  order by b.created_at desc;
$$;

-- Only the website's server (using the secret key) can call this.
revoke all on function public.admin_book_overview() from public, anon, authenticated;
grant execute on function public.admin_book_overview() to service_role;


-- ---------------------------------------------------------------------------
-- Check: this should show your email. If it shows nothing, create an account
-- on the website with chaptersofalifeuk@gmail.com, then run this file again.
-- ---------------------------------------------------------------------------

select u.email as admin_email
from public.admins a
join auth.users u on u.id = a.user_id;
