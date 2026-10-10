-- 0008 — Save-The-Day Gift Shop: product photo galleries + editable catalogue.
-- Idempotent. Adds a `photos` gallery (ordered list of image URLs, first = cover)
-- to gift_products, lets admins edit products, seeds the base catalogue, and
-- creates a public Storage bucket for uploaded photos.

-- 1) Gallery column (array of image URLs; the first entry is the cover).
alter table public.gift_products add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.gift_products add column if not exists sort   int;

-- 2) Admins can create / edit products (customers & anon keep read-only).
drop policy if exists gift_products_admin_write on public.gift_products;
create policy gift_products_admin_write on public.gift_products
  for all using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.gift_products to authenticated;

-- 3) Seed the base catalogue (mirrors src/data/shop.js). Safe to re-run:
--    existing rows are left untouched so admin edits are never overwritten.
insert into public.gift_products (id, name, emoji, category, price, eta, blurb, photos, sort) values
  ('g_roses',    'Two-Dozen Red Roses',     '🌹', 'flowers',     4500, '2 hr',    'Hand-tied, wrapped, card included.', '[]', 10),
  ('g_mixed',    'Seasonal Mixed Bouquet',  '💐', 'flowers',     3200, '2 hr',    'Florist''s pick of the day.',        '[]', 20),
  ('g_cake',     'Celebration Cake (1kg)',  '🎂', 'cakes',       3800, '3 hr',    'Vanilla or chocolate, iced message.','[]', 30),
  ('g_cupcakes', 'Cupcake Box (12)',        '🧁', 'cakes',       2600, '3 hr',    'Assorted, boxed & ribboned.',        '[]', 40),
  ('g_hamper',   'Deluxe Treat Hamper',     '🧺', 'hampers',     6900, '4 hr',    'Chocolates, nuts, preserves, tea.',  '[]', 50),
  ('g_baby',     'New Baby Hamper',         '🍼', 'hampers',     5400, '4 hr',    'Onesie, blanket, soft toy, card.',   '[]', 60),
  ('g_wine',     'Wine & Chocolate Duo',    '🍷', 'drinks',      4200, '3 hr',    'Red or white + truffle box.',        '[]', 70),
  ('g_bubbly',   'Celebration Bubbly',      '🍾', 'drinks',      3500, '3 hr',    'Chilled sparkling, ready to pop.',   '[]', 80),
  ('g_spa',      'Spa Day Voucher',         '💆', 'experiences', 7500, 'instant', 'Redeemable at partner spas.',        '[]', 90),
  ('g_dinner',   'Dinner-for-Two Voucher',  '🍽️', 'experiences', 8000, 'instant', 'Partner restaurants, city-wide.',    '[]', 100),
  ('g_card2',    'Gift Card — KES 2,000',   '🎁', 'cards',       2000, 'instant', 'Spend on anything in the shop.',     '[]', 110),
  ('g_card5',    'Gift Card — KES 5,000',   '🎁', 'cards',       5000, 'instant', 'Spend on anything in the shop.',     '[]', 120)
on conflict (id) do nothing;

-- 4) Public Storage bucket for uploaded product photos.
insert into storage.buckets (id, name, public)
values ('shop-photos', 'shop-photos', true)
on conflict (id) do nothing;

-- Anyone may read (bucket is public); only admins may upload / change / remove.
drop policy if exists shop_photos_read on storage.objects;
create policy shop_photos_read on storage.objects
  for select using (bucket_id = 'shop-photos');

drop policy if exists shop_photos_admin_write on storage.objects;
create policy shop_photos_admin_write on storage.objects
  for insert with check (bucket_id = 'shop-photos' and public.is_admin());

drop policy if exists shop_photos_admin_update on storage.objects;
create policy shop_photos_admin_update on storage.objects
  for update using (bucket_id = 'shop-photos' and public.is_admin());

drop policy if exists shop_photos_admin_delete on storage.objects;
create policy shop_photos_admin_delete on storage.objects
  for delete using (bucket_id = 'shop-photos' and public.is_admin());
