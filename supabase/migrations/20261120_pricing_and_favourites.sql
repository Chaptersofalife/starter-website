-- Chapters of a Life: new pricing details and favourite memories
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run the earlier files in supabase/migrations first (you already have).
--
-- What it does:
--   1. Orders record the number of pages (24, or 32 with the upgrade) and the
--      delivery charge, so emails and the admin area can show them.
--   2. Memories can be starred as a "favourite" by the book's organiser.
--      Row Level Security: only the organiser can change it, and not once
--      the book is approved for printing (locked).


-- ---------------------------------------------------------------------------
-- 1. Orders: pages and delivery
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists page_count integer not null default 24,
  add column if not exists delivery_pence integer not null default 0;

alter table public.orders drop constraint if exists orders_page_count_valid;
alter table public.orders add constraint orders_page_count_valid check (page_count in (24, 32));

alter table public.orders drop constraint if exists orders_delivery_valid;
alter table public.orders add constraint orders_delivery_valid check (delivery_pence >= 0);


-- ---------------------------------------------------------------------------
-- 2. Favourite memories
-- ---------------------------------------------------------------------------

alter table public.memories add column if not exists favourite boolean not null default false;

-- Organisers may change only the review columns (now including favourite).
-- The update rule from the previous file still applies: their own books only,
-- and not once a book is locked.
revoke update on table public.memories from authenticated;
grant update (status, edited_memory, edited_sayings, edited_at, favourite) on table public.memories to authenticated;
