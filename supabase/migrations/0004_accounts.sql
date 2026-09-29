-- 0004 — accounts & roles hardening.
-- Run after 0003. Adds email to profiles, makes signup ALWAYS default to
-- customer (never trust a self-declared role — admin promotes), lets admins
-- manage roles, and adds a whoami() RPC the app uses to route by role.

-- Email on profiles so admins can find and link accounts by email.
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email
  from auth.users u where u.id = p.id and p.email is null;

-- requested_role: what a staff sign-up asked to be (advisory only — the admin
-- still has to approve). Never becomes the actual role automatically.
alter table public.profiles add column if not exists requested_role text;

-- Signup trigger: default EVERYONE to customer (a self-declared 'admin' in
-- signup metadata must never be honoured). Capture name, email, and the
-- requested role (advisory) if one was supplied at sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, name, phone, email, requested_role)
  values (
    new.id, 'customer',
    new.raw_user_meta_data->>'name',
    new.phone,
    new.email,
    nullif(new.raw_user_meta_data->>'requested_role', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Admins may update any profile (to change a role). Self-update stays from 0002.
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- whoami(): the caller's role + linked provider/assessor ids in one round-trip.
create or replace function public.whoami()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'uid', auth.uid(),
    'role', public.my_role(),
    'providerId', public.my_provider_id(),
    'assessorId', public.my_assessor_id(),
    'email', (select email from public.profiles where id = auth.uid()),
    'isAnonymous', coalesce((select is_anonymous from auth.users where id = auth.uid()), false)
  )
$$;
grant execute on function public.whoami() to anon, authenticated;
