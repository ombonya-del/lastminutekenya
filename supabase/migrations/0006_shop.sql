-- 0006 — Save-The-Day Gift Shop: products + orders.
-- Idempotent. Products mirror src/data/shop.js; orders capture a checkout.

create table if not exists public.gift_products (
  id        text primary key,
  name      text not null,
  emoji     text,
  category  text,
  price     int not null,
  eta       text,
  blurb     text,
  active    boolean not null default true
);

create table if not exists public.gift_orders (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.profiles (id) on delete set null,
  recipient   text,
  address     text,
  message     text,
  phone       text,
  subtotal    int not null default 0,
  delivery    int not null default 0,
  total       int not null default 0,
  status      text not null default 'pending_payment'
              check (status in ('pending_payment','paid','dispatched','delivered','cancelled')),
  mpesa_ref   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.gift_order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.gift_orders (id) on delete cascade,
  product_id text,
  name       text,
  qty        int not null default 1,
  price      int not null default 0
);

alter table public.gift_products    enable row level security;
alter table public.gift_orders      enable row level security;
alter table public.gift_order_items enable row level security;

-- Products are public catalogue.
drop policy if exists gift_products_read on public.gift_products;
create policy gift_products_read on public.gift_products for select using (true);
grant select on public.gift_products to anon, authenticated;

-- A customer sees and creates only their own orders; admins see all.
drop policy if exists gift_orders_own on public.gift_orders;
create policy gift_orders_own on public.gift_orders for select
  using (client_id = auth.uid() or public.is_admin());
drop policy if exists gift_orders_insert on public.gift_orders;
create policy gift_orders_insert on public.gift_orders for insert
  with check (client_id = auth.uid());
drop policy if exists gift_items_own on public.gift_order_items;
create policy gift_items_own on public.gift_order_items for select
  using (exists (select 1 from public.gift_orders o where o.id = order_id and (o.client_id = auth.uid() or public.is_admin())));
drop policy if exists gift_items_insert on public.gift_order_items;
create policy gift_items_insert on public.gift_order_items for insert
  with check (exists (select 1 from public.gift_orders o where o.id = order_id and o.client_id = auth.uid()));
