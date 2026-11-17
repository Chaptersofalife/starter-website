-- Chapters of a Life: book details
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run 20261113_organiser_accounts.sql first (you already have).
--
-- Adds the details an organiser fills in when starting a book.
-- Row Level Security stays on, with the same rules: each organiser can only
-- see, create, change or delete their own books.


-- The person's full name (renamed from loved_one_name, keeping any data)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'books' and column_name = 'loved_one_name'
  ) then
    alter table public.books rename column loved_one_name to full_name;
  end if;
end;
$$;

alter table public.books
  add column if not exists known_as text,
  add column if not exists date_of_birth date,
  add column if not exists date_of_death date,
  add column if not exists lived_in text,
  add column if not exists introduction text,
  add column if not exists updated_at timestamptz not null default now();


-- Sensible limits, checked by the database itself
alter table public.books drop constraint if exists books_full_name_length;
alter table public.books add constraint books_full_name_length
  check (char_length(btrim(full_name)) between 1 and 200);

alter table public.books drop constraint if exists books_known_as_length;
alter table public.books add constraint books_known_as_length
  check (known_as is null or char_length(known_as) <= 100);

alter table public.books drop constraint if exists books_lived_in_length;
alter table public.books add constraint books_lived_in_length
  check (lived_in is null or char_length(lived_in) <= 200);

alter table public.books drop constraint if exists books_introduction_length;
alter table public.books add constraint books_introduction_length
  check (introduction is null or char_length(introduction) <= 2000);

alter table public.books drop constraint if exists books_dates_in_order;
alter table public.books add constraint books_dates_in_order
  check (date_of_birth is null or date_of_death is null or date_of_death >= date_of_birth);


-- Keep updated_at current whenever a book is edited
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
  before update on public.books
  for each row execute procedure public.set_updated_at();


-- Row Level Security: make sure it's on (it already is) and the rules are in place
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
