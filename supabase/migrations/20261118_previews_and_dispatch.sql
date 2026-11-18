-- Chapters of a Life: book previews, approval, and dispatch
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run the earlier files in supabase/migrations first (you already have).
--
-- What it does:
--   1. A PRIVATE storage bucket, "book-previews", for preview PDFs. It has no
--      access rules, so only the website's server can reach it. The server
--      shows a preview only to that book's organiser and to you.
--   2. A list of preview versions for each order (all versions are kept), and
--      the organiser's response to each (approved / changes requested).
--   3. A new order status, "changes_requested", plus tracking details.
--   4. Locking: once a preview is approved, the book is locked. The database
--      then refuses any change by the organiser (details, cover, closing
--      date, memories, photos, invitations) and any new memory from contributors.


-- ---------------------------------------------------------------------------
-- 1. Private bucket for preview PDFs
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-previews', 'book-previews', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- 2. Preview versions
-- ---------------------------------------------------------------------------

create table if not exists public.order_previews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  version integer not null,
  file_path text not null unique,
  file_name text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now(),
  response text,
  response_message text,
  responded_at timestamptz,

  constraint order_previews_one_per_version unique (order_id, version),
  constraint order_previews_response_valid check (response is null or response in ('approved', 'changes_requested')),
  constraint order_previews_message_length check (response_message is null or char_length(response_message) <= 2000)
);

create index if not exists order_previews_order_id_idx on public.order_previews (order_id, version desc);

alter table public.order_previews enable row level security;

-- Organisers can see the previews for their own orders. Only the website's
-- server can add previews or record responses.
drop policy if exists "Organisers can see their own previews" on public.order_previews;
create policy "Organisers can see their own previews"
  on public.order_previews for select
  to authenticated
  using (exists (select 1 from public.orders o where o.id = order_previews.order_id and o.organiser_id = (select auth.uid())));

revoke insert, update, delete on table public.order_previews from authenticated;
revoke all on table public.order_previews from anon;


-- ---------------------------------------------------------------------------
-- 3. Order status and tracking
-- ---------------------------------------------------------------------------

alter table public.orders drop constraint if exists orders_status_valid;
alter table public.orders add constraint orders_status_valid check (status in (
  'awaiting_payment', 'payment_failed', 'expired',
  'paid',               -- Paid – being designed
  'preview_sent',       -- Preview sent
  'changes_requested',  -- Changes requested
  'approved',           -- Approved
  'sent_to_printer', 'dispatched', 'delivered', 'refunded'
));

alter table public.orders
  add column if not exists approved_at timestamptz,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists dispatched_at timestamptz;

alter table public.orders drop constraint if exists orders_tracking_lengths;
alter table public.orders add constraint orders_tracking_lengths check (
  (tracking_number is null or char_length(tracking_number) <= 100)
  and (tracking_url is null or (char_length(tracking_url) <= 500 and tracking_url ~ '^https?://'))
);


-- ---------------------------------------------------------------------------
-- 4. Locking a book once its preview is approved
-- ---------------------------------------------------------------------------

alter table public.books add column if not exists locked_at timestamptz;

-- "Is this book still open to changes by its organiser?"
create or replace function public.book_editable(target_book uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.books b
    where b.id = target_book
      and b.organiser_id = (select auth.uid())
      and b.locked_at is null
  );
$$;

revoke all on function public.book_editable(uuid) from public, anon;
grant execute on function public.book_editable(uuid) to authenticated;

-- Books: organisers can't change or delete a locked book.
drop policy if exists "Organisers can update their own books" on public.books;
create policy "Organisers can update their own books"
  on public.books for update
  to authenticated
  using ((select auth.uid()) = organiser_id and locked_at is null)
  with check ((select auth.uid()) = organiser_id and locked_at is null);

drop policy if exists "Organisers can delete their own books" on public.books;
create policy "Organisers can delete their own books"
  on public.books for delete
  to authenticated
  using ((select auth.uid()) = organiser_id and locked_at is null);

-- Memories: no reviewing, editing or deleting once locked.
drop policy if exists "Organisers can review memories in their own books" on public.memories;
create policy "Organisers can review memories in their own books"
  on public.memories for update
  to authenticated
  using (public.book_editable(book_id))
  with check (public.book_editable(book_id));

drop policy if exists "Organisers can delete memories in their own books" on public.memories;
create policy "Organisers can delete memories in their own books"
  on public.memories for delete
  to authenticated
  using (public.book_editable(book_id));

-- Photos: no hiding or showing once locked.
drop policy if exists "Organisers can hide photos in their own books" on public.memory_photos;
create policy "Organisers can hide photos in their own books"
  on public.memory_photos for update
  to authenticated
  using (public.book_editable(book_id))
  with check (public.book_editable(book_id));

-- Invitations: no new, changed or removed invitations once locked.
drop policy if exists "Organisers can add invitations" on public.invitations;
create policy "Organisers can add invitations"
  on public.invitations for insert
  to authenticated
  with check (public.book_editable(book_id));

drop policy if exists "Organisers can update their invitations" on public.invitations;
create policy "Organisers can update their invitations"
  on public.invitations for update
  to authenticated
  using (public.book_editable(book_id))
  with check (public.book_editable(book_id));

drop policy if exists "Organisers can remove invitations" on public.invitations;
create policy "Organisers can remove invitations"
  on public.invitations for delete
  to authenticated
  using (public.book_editable(book_id));

-- Contributors: approving a preview also closes the book (closed_at), so
-- submit_memory() refuses new memories and photos. The organiser can't reopen
-- it, because a locked book can no longer be updated (rule above).
