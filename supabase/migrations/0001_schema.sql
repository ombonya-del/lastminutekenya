-- LastMinuteKenya — schema
-- Run first. Creates the tables that mirror src/data/seed.js, plus public
-- read-only views so the anon key can power matching WITHOUT exposing PII.
--
-- Postgres in Supabase already has pgcrypto (gen_random_uuid) available.

-- ---------------------------------------------------------------------------
-- Enums (kept as text + CHECK for easy evolution)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user, carries the role.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'customer'
              check (role in ('customer','provider','assessor','admin')),
  name        text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- providers (Last Minute Network)
-- ---------------------------------------------------------------------------
create table if not exists public.providers (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid references public.profiles (id) on delete set null,
  name              text not null,
  lead              text,
  phone             text,
  email             text,
  categories        text[] not null default '{}',
  base_lat          double precision not null,
  base_lng          double precision not null,
  area              text not null,
  rating            numeric(2,1) not null default 4.0,
  jobs_done         int not null default 0,
  readiness         text not null default 'ready' check (readiness in ('ready','busy','off')),
  capacity          int not null default 0,
  response_mins     int not null default 45,
  channels          jsonb not null default '{}'::jsonb,
  preferred_channel text,
  blurb             text,
  created_at        timestamptz not null default now()
);
create index if not exists providers_categories_idx on public.providers using gin (categories);

-- ---------------------------------------------------------------------------
-- assessors (staff who do the on-site visits)
-- ---------------------------------------------------------------------------
create table if not exists public.assessors (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles (id) on delete set null,
  name        text not null,
  phone       text,
  area        text,
  rating      numeric(2,1) default 4.8,
  visits      int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- events (the thing being served)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles (id) on delete cascade,
  type             text not null,
  title            text not null,
  area             text not null,
  coord_lat        double precision not null,
  coord_lng        double precision not null,
  venue            text,
  starts_at        timestamptz not null,
  guests           int not null default 0,
  booked_provider  text,
  category         text not null,
  budget           numeric,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- assessments -> scorecards
-- ---------------------------------------------------------------------------
create table if not exists public.assessments (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  requested_by  uuid not null references public.profiles (id) on delete cascade,
  assessor_id   uuid references public.assessors (id) on delete set null,
  status        text not null default 'requested'
                check (status in ('requested','assigned','on_site','scored')),
  concern       text,
  answers       jsonb not null default '{}'::jsonb,
  notes         text,
  band          text check (band in ('red','amber','green')),
  score         int,
  requested_at  timestamptz not null default now(),
  visited_at    timestamptz,
  scored_at     timestamptz
);
create index if not exists assessments_event_idx on public.assessments (event_id);

-- ---------------------------------------------------------------------------
-- sos_jobs (live rescues)
-- ---------------------------------------------------------------------------
create table if not exists public.sos_jobs (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events (id) on delete cascade,
  from_assessment  uuid references public.assessments (id) on delete set null,
  category         text not null,
  status           text not null default 'dispatching'
                   check (status in ('new','dispatching','accepted','resolved')),
  note             text,
  accepted_by      uuid references public.providers (id) on delete set null,
  raised_at        timestamptz not null default now()
);
create index if not exists sos_open_idx on public.sos_jobs (status);

-- ---------------------------------------------------------------------------
-- alerts (pre-dispatch advisory log; written by the edge function / trigger)
-- ---------------------------------------------------------------------------
create table if not exists public.alerts (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references public.providers (id) on delete cascade,
  provider_name text,
  channel       text not null check (channel in ('whatsapp','sms','email')),
  kind          text not null check (kind in ('assessment','sos')),
  likelihood    text not null check (likelihood in ('high','possible','low')),
  category      text not null,
  area          text,
  ref_id        text,
  km            numeric,
  match_score   int,
  message       text not null,
  status        text not null default 'queued' check (status in ('queued','sent','failed')),
  acknowledged  boolean not null default false,
  sent_at       timestamptz not null default now()
);
create index if not exists alerts_provider_idx on public.alerts (provider_id);

-- ---------------------------------------------------------------------------
-- Public, read-only views for the anon key (no phone / contact PII).
-- The client needs provider coords + categories for distance matching; it
-- must NOT be able to read phone numbers or the base PII tables directly.
-- ---------------------------------------------------------------------------
create or replace view public.providers_public
with (security_invoker = true) as
  select id, name, categories, base_lat, base_lng, area, rating,
         jobs_done, readiness, capacity, response_mins, blurb
  from public.providers;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a user signs up. Role can be set from the
-- signup metadata (raw_user_meta_data->>'role'), defaulting to 'customer'.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'name',
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
