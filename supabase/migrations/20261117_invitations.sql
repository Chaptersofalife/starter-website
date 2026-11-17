-- Chapters of a Life: email invitations and reminders
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run the earlier files in supabase/migrations first (you already have).
--
-- What it does:
--   1. Adds "invitations": the people an organiser has invited by email.
--      Each has its own private code, used for their personal invite link
--      (so we know when they've added a memory) and their "stop reminders"
--      link. Row Level Security: only the book's organiser can see or manage
--      their invitations.
--   2. Links memories to the invitation they came from (when known).
--   3. Remembers which reminder emails have been sent for each book's
--      closing date, so each is sent only once (and again if the date changes).


-- ---------------------------------------------------------------------------
-- 1. Invitations
-- ---------------------------------------------------------------------------

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  email text not null,
  first_name text,
  personal_message text,
  token text not null unique default public.new_invite_token(),
  send_count integer not null default 0,
  last_sent_at timestamptz,
  last_reminder_at timestamptz,
  reminders_stopped_at timestamptz,
  created_at timestamptz not null default now(),

  constraint invitations_one_per_email unique (book_id, email),
  constraint invitations_email_valid check (
    email = lower(email) and char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint invitations_first_name_length check (first_name is null or char_length(first_name) <= 60),
  constraint invitations_message_length check (personal_message is null or char_length(personal_message) <= 1000)
);

create index if not exists invitations_book_id_idx on public.invitations (book_id);

alter table public.invitations enable row level security;

drop policy if exists "Organisers can see their invitations" on public.invitations;
create policy "Organisers can see their invitations"
  on public.invitations for select
  to authenticated
  using (exists (select 1 from public.books b where b.id = invitations.book_id and b.organiser_id = (select auth.uid())));

drop policy if exists "Organisers can add invitations" on public.invitations;
create policy "Organisers can add invitations"
  on public.invitations for insert
  to authenticated
  with check (exists (select 1 from public.books b where b.id = invitations.book_id and b.organiser_id = (select auth.uid())));

drop policy if exists "Organisers can update their invitations" on public.invitations;
create policy "Organisers can update their invitations"
  on public.invitations for update
  to authenticated
  using (exists (select 1 from public.books b where b.id = invitations.book_id and b.organiser_id = (select auth.uid())))
  with check (exists (select 1 from public.books b where b.id = invitations.book_id and b.organiser_id = (select auth.uid())));

drop policy if exists "Organisers can remove invitations" on public.invitations;
create policy "Organisers can remove invitations"
  on public.invitations for delete
  to authenticated
  using (exists (select 1 from public.books b where b.id = invitations.book_id and b.organiser_id = (select auth.uid())));

-- Organisers may only change these details (not the private code, and not
-- whether someone has stopped their reminders).
revoke update on table public.invitations from authenticated;
grant update (first_name, personal_message, send_count, last_sent_at) on table public.invitations to authenticated;

-- Visitors who aren't signed in get no access at all.
revoke all on table public.invitations from anon;


-- ---------------------------------------------------------------------------
-- 2. Which invitation a memory came from
-- ---------------------------------------------------------------------------

alter table public.memories
  add column if not exists invitation_id uuid references public.invitations (id) on delete set null;

create index if not exists memories_invitation_id_idx on public.memories (invitation_id);


-- ---------------------------------------------------------------------------
-- 3. Reminder emails already sent (one set per closing date)
-- ---------------------------------------------------------------------------

alter table public.books
  add column if not exists reminder_7_sent_for date,
  add column if not exists reminder_2_sent_for date,
  add column if not exists organiser_summary_sent_for date,
  add column if not exists organiser_closed_notice_key text;
