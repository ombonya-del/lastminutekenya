-- 0007 — payment tracking for gift orders (M-Pesa callback + method).
-- Idempotent.

alter table public.gift_orders add column if not exists method text default 'mpesa';
alter table public.gift_orders add column if not exists checkout_request_id text;
alter table public.gift_orders add column if not exists provider_ref text; -- Flutterwave tx ref / others

create index if not exists gift_orders_checkout_idx on public.gift_orders (checkout_request_id);
