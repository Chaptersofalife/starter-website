-- Chapters of a Life: orders and payments (Stripe Checkout)
--
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again; it won't duplicate anything.
-- Run the earlier files in supabase/migrations first (you already have).
--
-- How orders stay trustworthy:
--   - Orders are created and updated only by the website's server (secret
--     key), never directly by visitors or organisers. The price is worked out
--     on the server, so nobody can change what they pay.
--   - An order is marked as paid ONLY when Stripe confirms the payment
--     (through the signed webhook), not when someone reaches the thank-you page.
--   - Row Level Security: organisers can see their own orders, and nothing else.
--   - Orders are kept even if the book is later deleted (for your records:
--     UK tax law requires sales records to be kept for six years).


create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books (id) on delete set null,
  organiser_id uuid references auth.users (id) on delete set null,
  organiser_email text not null,
  book_name text not null,

  extra_copies integer not null default 0,
  total_copies integer not null,
  amount_pence integer not null,
  currency text not null default 'gbp',

  delivery_name text not null,
  address_line1 text not null,
  address_line2 text,
  town text not null,
  county text,
  postcode text not null,
  country text not null default 'GB',
  phone text,

  status text not null default 'awaiting_payment',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  status_changed_at timestamptz not null default now(),
  confirmation_emails_sent_at timestamptz,
  created_at timestamptz not null default now(),

  constraint orders_status_valid check (status in (
    'awaiting_payment',   -- sent to Stripe, not paid yet
    'payment_failed',     -- Stripe said the payment didn't go through
    'expired',            -- they left without paying
    'paid',               -- Paid – being designed
    'preview_sent',       -- Preview sent
    'approved',           -- Approved
    'sent_to_printer',    -- Sent to printer
    'dispatched',         -- Dispatched
    'delivered',          -- Delivered
    'refunded'            -- Refunded
  )),
  constraint orders_copies_valid check (extra_copies between 0 and 10 and total_copies = extra_copies + 1),
  constraint orders_amount_valid check (amount_pence > 0),
  constraint orders_country_uk check (country = 'GB'),
  constraint orders_text_lengths check (
    char_length(delivery_name) between 1 and 100
    and char_length(address_line1) between 1 and 120
    and (address_line2 is null or char_length(address_line2) <= 120)
    and char_length(town) between 1 and 80
    and (county is null or char_length(county) <= 80)
    and char_length(postcode) between 5 and 10
    and (phone is null or char_length(phone) <= 30)
  )
);

create index if not exists orders_book_id_idx on public.orders (book_id);
create index if not exists orders_organiser_id_idx on public.orders (organiser_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

alter table public.orders enable row level security;

-- Organisers can see their own orders. (No insert/update/delete rules: only
-- the website's server, using the secret key, can create or change orders.)
drop policy if exists "Organisers can see their own orders" on public.orders;
create policy "Organisers can see their own orders"
  on public.orders for select
  to authenticated
  using (organiser_id = (select auth.uid()));

revoke insert, update, delete on table public.orders from authenticated;
revoke all on table public.orders from anon;
