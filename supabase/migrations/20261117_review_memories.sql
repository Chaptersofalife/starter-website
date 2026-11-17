-- Chapters of a Life: reviewing memories before the book is made
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run the earlier files in supabase/migrations first (you already have).
--
-- What it does:
--   - Each memory gets a review status: waiting (new), approved or hidden.
--   - The organiser can correct a memory's text. Their version is saved
--     separately (edited_memory / edited_sayings); the contributor's own words
--     are never changed, so an edit can always be undone.
--   - Individual photos can be hidden without hiding the whole memory.
--   - The organiser can delete a memory.
--
-- Row Level Security: only the book's organiser can do any of this.
-- Even the organiser can only change the review settings and their own edits,
-- never what the contributor originally wrote.


-- ---------------------------------------------------------------------------
-- Memories: status and the organiser's edits
-- ---------------------------------------------------------------------------

alter table public.memories
  add column if not exists status text not null default 'waiting',
  add column if not exists edited_memory text,
  add column if not exists edited_sayings text,
  add column if not exists edited_at timestamptz;

alter table public.memories drop constraint if exists memories_status_valid;
alter table public.memories add constraint memories_status_valid
  check (status in ('waiting', 'approved', 'hidden'));

alter table public.memories drop constraint if exists memories_edited_memory_length;
alter table public.memories add constraint memories_edited_memory_length
  check (edited_memory is null or char_length(edited_memory) between 1 and 10000);

alter table public.memories drop constraint if exists memories_edited_sayings_length;
alter table public.memories add constraint memories_edited_sayings_length
  check (edited_sayings is null or char_length(edited_sayings) <= 2000);

create index if not exists memories_book_id_status_idx on public.memories (book_id, status);

-- Signed-in users may only change these columns, never the contributor's words.
revoke update on table public.memories from authenticated;
grant update (status, edited_memory, edited_sayings, edited_at) on table public.memories to authenticated;

-- ...and only on memories in their own books.
drop policy if exists "Organisers can review memories in their own books" on public.memories;
create policy "Organisers can review memories in their own books"
  on public.memories for update
  to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = memories.book_id
        and b.organiser_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.books b
      where b.id = memories.book_id
        and b.organiser_id = (select auth.uid())
    )
  );

drop policy if exists "Organisers can delete memories in their own books" on public.memories;
create policy "Organisers can delete memories in their own books"
  on public.memories for delete
  to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = memories.book_id
        and b.organiser_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------------
-- Photos: hide individual photos
-- ---------------------------------------------------------------------------

alter table public.memory_photos
  add column if not exists hidden boolean not null default false;

-- Signed-in users may only change whether a photo is hidden.
revoke update on table public.memory_photos from authenticated;
grant update (hidden) on table public.memory_photos to authenticated;

drop policy if exists "Organisers can hide photos in their own books" on public.memory_photos;
create policy "Organisers can hide photos in their own books"
  on public.memory_photos for update
  to authenticated
  using (
    exists (
      select 1 from public.books b
      where b.id = memory_photos.book_id
        and b.organiser_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.books b
      where b.id = memory_photos.book_id
        and b.organiser_id = (select auth.uid())
    )
  );

-- Visitors who aren't signed in still get no access to either table.
revoke all on table public.memories from anon;
revoke all on table public.memory_photos from anon;
