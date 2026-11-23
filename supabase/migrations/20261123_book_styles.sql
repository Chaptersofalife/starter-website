-- Chapters of a Life: book styles (cover colours)
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
--
-- Each book gets a style, chosen by its organiser: evergreen (the default),
-- deep_sea, soft_lavender or charcoal_linen. Existing books become Evergreen.
-- The organiser can change it until the preview is approved (the existing
-- Row Level Security rules already stop changes to a locked book).

alter table public.books
  add column if not exists book_style text not null default 'evergreen';

alter table public.books drop constraint if exists books_book_style_valid;
alter table public.books add constraint books_book_style_valid
  check (book_style in ('evergreen', 'deep_sea', 'soft_lavender', 'charcoal_linen'));
