-- Chapters of a Life: closing dates for books
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run the earlier files in supabase/migrations first (you already have).
--
-- What it does:
--   - Each book can have a closing date (closes_on). Memories are welcome
--     until the END of that day, UK time. No date means it stays open.
--   - The organiser can also close a book early (closed_at), and reopen it.
--   - The database itself refuses new memories once a book is closed, so
--     nobody can get round it. (Photos can only be uploaded with a memory
--     that was accepted, so no new photos can arrive either.)
--   - The contributor page and the admin area learn whether a book is open.


-- ---------------------------------------------------------------------------
-- Closing date and "closed early" on books
-- ---------------------------------------------------------------------------

alter table public.books
  add column if not exists closes_on date,
  add column if not exists closed_at timestamptz;

-- "Is this book open for new memories?" One rule, used everywhere.
create or replace function public.book_is_open(closes_on date, closed_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select closed_at is null
     and (closes_on is null or (now() at time zone 'Europe/London')::date <= closes_on);
$$;


-- ---------------------------------------------------------------------------
-- Contributor "doors": now aware of closing
-- ---------------------------------------------------------------------------

-- What a contributor sees: name, dates, cover, and whether it's open.
drop function if exists public.get_invite(text);
create function public.get_invite(invite text)
returns table (
  full_name text,
  known_as text,
  date_of_birth date,
  date_of_death date,
  cover_display_path text,
  closes_on date,
  is_open boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.full_name, b.known_as, b.date_of_birth, b.date_of_death, b.cover_display_path,
         b.closes_on, public.book_is_open(b.closes_on, b.closed_at)
  from public.books b
  where char_length(invite) >= 32
    and b.invite_token = invite;
$$;

-- Adding a memory: now refused once the book is closed.
drop function if exists public.submit_memory(text, text, text, text, text, text);
create function public.submit_memory(
  invite text,
  contributor_name text,
  contributor_email text,
  relationship text,
  memory text,
  sayings text default null
)
returns table (memory_id uuid, book_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  target_book uuid;
  book_open boolean;
  new_memory uuid;
  recent_count integer;
  clean_name text := btrim(coalesce(contributor_name, ''));
  clean_email text := lower(btrim(coalesce(contributor_email, '')));
  clean_relationship text := btrim(coalesce(relationship, ''));
  clean_memory text := btrim(coalesce(memory, ''));
  clean_sayings text := nullif(btrim(coalesce(sayings, '')), '');
begin
  select b.id, public.book_is_open(b.closes_on, b.closed_at)
    into target_book, book_open
  from public.books b
  where char_length(invite) >= 32
    and b.invite_token = invite;

  if target_book is null then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  -- The book has closed: no new memories (or photos).
  if not book_open then
    raise exception 'book_closed' using errcode = 'P0001';
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
  values (target_book, clean_name, clean_email, clean_relationship, clean_memory, clean_sayings)
  returning id into new_memory;

  return query select new_memory, target_book;
end;
$$;

revoke all on function public.get_invite(text) from public, anon, authenticated;
revoke all on function public.submit_memory(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.submit_memory(text, text, text, text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Admin overview: now includes closing date and open/closed
-- ---------------------------------------------------------------------------

drop function if exists public.admin_book_overview();
create function public.admin_book_overview()
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
  photos integer,
  closes_on date,
  closed_at timestamptz,
  is_open boolean
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
    (select count(*) from public.memory_photos ph where ph.book_id = b.id and ph.uploaded)::integer,
    b.closes_on,
    b.closed_at,
    public.book_is_open(b.closes_on, b.closed_at)
  from public.books b
  left join public.profiles p on p.id = b.organiser_id
  left join auth.users u on u.id = b.organiser_id
  order by b.created_at desc;
$$;

-- Only the website's server (using the secret key) can call this.
revoke all on function public.admin_book_overview() from public, anon, authenticated;
grant execute on function public.admin_book_overview() to service_role;
