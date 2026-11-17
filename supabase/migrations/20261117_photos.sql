-- Chapters of a Life: photos (cover photos and contributors' photos)
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run the earlier files in supabase/migrations first (you already have).
--
-- How photos are kept private:
--   - They're stored in a PRIVATE storage bucket, "book-photos". It has no
--     public web addresses, and no access rules for visitors or organisers:
--     nobody can list, open or upload files with the website's public key.
--   - Only the website's server can reach the bucket, using the secret key.
--     Before it does anything, it checks who is asking (the book's organiser,
--     or a contributor holding that book's private invite link).
--   - Photos are shown with signed links that expire after an hour.
--   - File names include long random codes, so they can't be guessed.
--   - Row Level Security means only a book's organiser can read the list of
--     photos sent to that book.
--
-- For every photo we keep three files:
--   original    the untouched file exactly as uploaded (for printing)
--   display     a JPEG up to 2048 pixels, for viewing on screen
--   thumb       a JPEG up to 480 pixels, for small previews


-- ---------------------------------------------------------------------------
-- 1. The private storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-photos',
  'book-photos',
  false,                                   -- private: no public web addresses
  52428800,                                -- 50 MB per file
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage policies are added on purpose: with none, the website's public
-- key can't read, list or upload anything in this bucket.


-- ---------------------------------------------------------------------------
-- 2. Cover photo details on books
-- ---------------------------------------------------------------------------

alter table public.books
  add column if not exists cover_original_path text,
  add column if not exists cover_display_path text,
  add column if not exists cover_thumb_path text,
  add column if not exists cover_width integer,
  add column if not exists cover_height integer;


-- ---------------------------------------------------------------------------
-- 3. Contributors' photos
-- ---------------------------------------------------------------------------

create table if not exists public.memory_photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  position smallint not null,
  original_path text not null unique,
  display_path text not null,
  thumb_path text not null,
  original_name text,
  mime_type text not null,
  size_bytes bigint not null,
  width integer,
  height integer,
  caption text,
  taken_text text,
  uploaded boolean not null default false,
  created_at timestamptz not null default now(),

  constraint memory_photos_position check (position between 0 and 9),
  constraint memory_photos_one_per_position unique (memory_id, position),
  constraint memory_photos_mime check (mime_type in ('image/jpeg', 'image/png', 'image/heic', 'image/heif')),
  constraint memory_photos_size check (size_bytes between 1 and 52428800),
  constraint memory_photos_caption_length check (caption is null or char_length(caption) <= 300),
  constraint memory_photos_taken_length check (taken_text is null or char_length(taken_text) <= 60)
);

create index if not exists memory_photos_memory_id_idx on public.memory_photos (memory_id, position);
create index if not exists memory_photos_book_id_idx on public.memory_photos (book_id);

alter table public.memory_photos enable row level security;

-- Only the book's organiser can see its photos.
drop policy if exists "Organisers can read photos for their own books" on public.memory_photos;
create policy "Organisers can read photos for their own books"
  on public.memory_photos for select
  to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = memory_photos.book_id
        and b.organiser_id = (select auth.uid())
    )
  );

-- No insert, update or delete policies: only the website's server adds photos,
-- after checking the invite link.
revoke all on table public.memory_photos from anon;


-- ---------------------------------------------------------------------------
-- 4. Update the contributor "doors"
-- ---------------------------------------------------------------------------

-- get_invite now also says where the cover photo is, so the server can show
-- it. (It still returns nothing else about the book.)
drop function if exists public.get_invite(text);
create function public.get_invite(invite text)
returns table (
  full_name text,
  known_as text,
  date_of_birth date,
  date_of_death date,
  cover_display_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.full_name, b.known_as, b.date_of_birth, b.date_of_death, b.cover_display_path
  from public.books b
  where char_length(invite) >= 32
    and b.invite_token = invite;
$$;

-- submit_memory now returns the new memory's ID (so photos can be attached)
-- and the book's ID. Everything else is unchanged.
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
  new_memory uuid;
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
  values (target_book, clean_name, clean_email, clean_relationship, clean_memory, clean_sayings)
  returning id into new_memory;

  return query select new_memory, target_book;
end;
$$;

-- Open exactly these two doors to visitors.
revoke all on function public.get_invite(text) from public, anon, authenticated;
revoke all on function public.submit_memory(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.submit_memory(text, text, text, text, text, text) to anon, authenticated;
