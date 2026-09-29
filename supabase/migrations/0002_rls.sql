-- LastMinuteKenya — Row Level Security
-- Run after 0001_schema.sql. House-style rule: the anon key may INSERT to public
-- forms but must NOT SELECT PII. Providers/assessors/clients each see only what
-- they need; the alerts table is written only by the service role.
--
-- Idempotent: every policy is dropped-if-exists before create, so this is safe
-- to re-run on a database that was already set up.

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so reading the caller's role does not recurse
-- through profiles' own RLS).
-- ---------------------------------------------------------------------------
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.my_provider_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.providers where profile_id = auth.uid() limit 1
$$;

create or replace function public.my_assessor_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.assessors where profile_id = auth.uid() limit 1
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere.
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.providers    enable row level security;
alter table public.assessors    enable row level security;
alter table public.events       enable row level security;
alter table public.assessments  enable row level security;
alter table public.sos_jobs     enable row level security;
alter table public.alerts       enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid());

-- providers ------------------------------------------------------------------
drop policy if exists providers_owner_read on public.providers;
create policy providers_owner_read on public.providers for select
  using (profile_id = auth.uid() or public.is_admin());
drop policy if exists providers_owner_update on public.providers;
create policy providers_owner_update on public.providers for update
  using (profile_id = auth.uid() or public.is_admin());
drop policy if exists providers_admin_insert on public.providers;
create policy providers_admin_insert on public.providers for insert
  with check (public.is_admin());

-- assessors ------------------------------------------------------------------
drop policy if exists assessors_read on public.assessors;
create policy assessors_read on public.assessors for select
  using (profile_id = auth.uid() or public.is_admin());
drop policy if exists assessors_admin_write on public.assessors;
create policy assessors_admin_write on public.assessors for all
  using (public.is_admin()) with check (public.is_admin());

-- events ---------------------------------------------------------------------
drop policy if exists events_owner_read on public.events;
create policy events_owner_read on public.events for select
  using (
    client_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.assessments a
      where a.event_id = events.id and a.assessor_id = public.my_assessor_id()
    )
  );
drop policy if exists events_client_insert on public.events;
create policy events_client_insert on public.events for insert
  with check (client_id = auth.uid());
drop policy if exists events_owner_update on public.events;
create policy events_owner_update on public.events for update
  using (client_id = auth.uid() or public.is_admin());

-- assessments ----------------------------------------------------------------
drop policy if exists assessments_read on public.assessments;
create policy assessments_read on public.assessments for select
  using (
    requested_by = auth.uid()
    or public.is_admin()
    or assessor_id = public.my_assessor_id()
  );
drop policy if exists assessments_client_insert on public.assessments;
create policy assessments_client_insert on public.assessments for insert
  with check (requested_by = auth.uid());
drop policy if exists assessments_assessor_update on public.assessments;
create policy assessments_assessor_update on public.assessments for update
  using (assessor_id = public.my_assessor_id() or public.is_admin());

-- sos_jobs -------------------------------------------------------------------
drop policy if exists sos_read on public.sos_jobs;
create policy sos_read on public.sos_jobs for select
  using (
    public.is_admin()
    or exists (select 1 from public.events e where e.id = sos_jobs.event_id and e.client_id = auth.uid())
    or (
      status <> 'resolved'
      and exists (
        select 1 from public.providers p
        where p.profile_id = auth.uid() and sos_jobs.category = any (p.categories)
      )
    )
  );
drop policy if exists sos_client_insert on public.sos_jobs;
create policy sos_client_insert on public.sos_jobs for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.events e where e.id = event_id and e.client_id = auth.uid())
  );
drop policy if exists sos_accept_update on public.sos_jobs;
create policy sos_accept_update on public.sos_jobs for update
  using (public.is_admin() or category in (select unnest(categories) from public.providers where profile_id = auth.uid()))
  with check (public.is_admin() or accepted_by = public.my_provider_id());

-- alerts ---------------------------------------------------------------------
drop policy if exists alerts_provider_read on public.alerts;
create policy alerts_provider_read on public.alerts for select
  using (provider_id = public.my_provider_id() or public.is_admin());
drop policy if exists alerts_provider_ack on public.alerts;
create policy alerts_provider_ack on public.alerts for update
  using (provider_id = public.my_provider_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants: expose ONLY the public view to anon (and authenticated). The base
-- providers table's PII stays behind RLS above.
-- ---------------------------------------------------------------------------
grant select on public.providers_public to anon, authenticated;
