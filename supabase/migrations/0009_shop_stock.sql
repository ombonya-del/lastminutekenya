-- 0009 — Save-The-Day Gift Shop: out-of-stock flag.
-- Idempotent. A sold-out product stays VISIBLE in the shop but can't be ordered.
-- (Display order uses the existing gift_products.sort column from 0008.)

alter table public.gift_products add column if not exists in_stock boolean not null default true;
