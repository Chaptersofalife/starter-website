-- Chapters of a Life: private invite links and memories
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run the earlier files in supabase/migrations first (you already have).
--
-- What it does:
--   1. Gives every book a private invite link code: 64 random characters,
--      practically impossible to guess. The organiser can replace it, which
--      turns the old link off.
--   2. Adds a "memories" table. Row Level Security means ONLY the book's
--      organiser can read its memories. Nobody can change or delete them
--      through the website's public key.
--   3. Adds two narrow "doors" that contributors use instead of touching any
--      table directly:
--        get_invite(code):     the person's name and dates, nothing else
--        submit_memory(...):   adds one memory, with checks and a flood limit
--      Contributors can't see other memories, books, emails or anything else.


-- ---------------------------------------------------------------------------
-- 1. Invite link codes on books
-- ---------------------------------------------------------------------------

-- Two random UUIDs joined: 64 characters, 244 random bits.
create or replace function public.new_invite_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

alter table public.books
  add column if not exists invite_token text not null default public.new_invite_token();

-- Every link code is different, and long enough to be unguessable.
create unique index if not exists books_invite_token_key on public.books (invite_token);

alter table public.books drop constraint if exists books_invite_token_length;
alter table public.books add constraint books_invite_token_length
  check (char_length(invite_token) >= 32);


-- ---------------------------------------------------------------------------
-- 2. Memories
-- ---------------------------------------------------------------------------

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  contributor_name text not null,
  contributor_email text not null,
  relationship text not null,
  memory text not null,
  sayings text,
  created_at timestamptz not null default now(),

  constraint memories_contributor_name_length check (char_length(contributor_name) between 1 and 100),
  constraint memories_contributor_email_length check (char_length(contributor_email) between 3 and 254),
  constraint memories_relationship_length check (char_length(relationship) between 1 and 100),
  constraint memories_memory_length check (char_length(memory) between 1 and 10000),
  constraint memories_sayings_length check (sayings is null or char_length(sayings) <= 2000)
);

create index if not exists memories_book_id_created_at_idx
  on public.memories (book_id, created_at desc);

alter table public.memories enable row level security;

-- Only the organiser of the book can read its memories.
drop policy if exists "Organisers can read memories for their own books" on public.memories;
create policy "Organisers can read memories for their own books"
  on public.memories for select
  to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = memories.book_id
        and b.organiser_id = (select auth.uid())
    )
  );

-- No insert, update or delete policies: nobody can change memories directly.
-- New memories only arrive through submit_memory() below.
-- Belt and braces: visitors who aren't signed in get no access to the table at all.
revoke all on table public.memories from anon;


-- ---------------------------------------------------------------------------
-- 3. The two doors for contributors
-- ---------------------------------------------------------------------------

-- What a contributor sees when they open a link: the name and dates only.
create or replace function public.get_invite(invite text)
returns table (
  full_name text,
  known_as text,
  date_of_birth date,
  date_of_death date
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.full_name, b.known_as, b.date_of_birth, b.date_of_death
  from public.books b
  where char_length(invite) >= 32
    and b.invite_token = invite;
$$;

-- Adds one memory to the book with this link, after checking it.
create or replace function public.submit_memory(
  invite text,
  contributor_name text,
  contributor_email text,
  relationship text,
  memory text,
  sayings text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_book uuid;
  recent_count integer;
  clean_name text := btrim(coalesce(contributor_name, ''));
  clean_email text := lower(btrim(coalesce(contributor_email, '')));
  clean_relationship text := btrim(coalesce(relationship, ''));
  clean_memory text := btrim(coalesce(memory, ''));
  clean_sayings text := nullif(btrim(coalesce(sayings, '')), '');
begin
  select b.id into target_book
  from public.books b
  where char_length(invite) >= 32
    and b.invite_token = invite;

  if target_book is null then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  if clean_name = '' or clean_relationship = '' or clean_memory = ''
     or clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_memory' using errcode = '22023';
  end if;

  -- Flood protection: at most 20 memories per book in any 10 minutes,
  -- and 1,000 in total.
  select count(*) into recent_count
  from public.memories m
  where m.book_id = target_book
    and m.created_at > now() - interval '10 minutes';
  if recent_count >= 20 then
    raise exception 'too_many_memories' using errcode = 'P0001';
  end if;

  if (select count(*) from public.memories m where m.book_id = target_book) >= 1000 then
    raise exception 'book_full' using errcode = 'P0001';
  end if;

  insert into public.memories (book_id, contributor_name, contributor_email, relationship, memory, sayings)
  values (target_book, clean_name, clean_email, clean_relationship, clean_memory, clean_sayings);
end;
$$;

-- Open exactly these two doors to visitors.
-- (new_invite_token() stays usable: it only makes random text, and the
-- database needs it whenever an organiser starts a new book.)
revoke all on function public.get_invite(text) from public, anon, authenticated;
revoke all on function public.submit_memory(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.submit_memory(text, text, text, text, text, text) to anon, authenticated;
