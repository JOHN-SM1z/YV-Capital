-- Self-service sign-up (email, Google, Apple, Microsoft) with YV approval.
--
-- Signing up never grants access on its own. A new account gets a *pending* access request that
-- a YV admin approves (choosing role and organization) or declines. The only automatic path is an
-- admin's pre-approval of an email address, applied when an account with that email exists and the
-- email is *confirmed* (verified by the email link or by the identity provider).

-- ───────────── tables ─────────────
create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_type public.user_type not null,
  is_org_admin boolean not null default false,
  full_name text check (char_length(full_name) <= 200),
  granted_by uuid references public.user_profiles(id) on delete set null,
  used_by uuid references public.user_profiles(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
-- At most one open pre-approval per email.
create unique index access_grants_open_email_idx on public.access_grants (email) where used_at is null;
create index access_grants_org_idx on public.access_grants (org_id);
create index access_grants_granted_by_idx on public.access_grants (granted_by);
create index access_grants_used_by_idx on public.access_grants (used_by);

create table public.access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 200),
  provider text,
  requested_role text check (requested_role in ('investor','founder','yv')),
  organization_name text check (char_length(organization_name) <= 200),
  message text check (char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  decided_by uuid references public.user_profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index access_requests_status_idx on public.access_requests (status, created_at desc);
create index access_requests_decided_by_idx on public.access_requests (decided_by);

alter table public.access_grants enable row level security;
alter table public.access_requests enable row level security;
revoke all on public.access_grants, public.access_requests from anon;

-- Pre-approvals: YV admins only. No update: revoke and re-add instead.
create policy ag_read on public.access_grants for select to authenticated using ((select private.is_yv_admin()));
create policy ag_insert on public.access_grants for insert to authenticated
  with check ((select private.is_yv_admin()) and granted_by = (select auth.uid()) and used_at is null and used_by is null);
create policy ag_delete on public.access_grants for delete to authenticated using ((select private.is_yv_admin()) and used_at is null);

-- Requests: the applicant reads their own, YV admins read all. All writes go through the
-- functions below (no insert/update/delete policies).
create policy ar_read on public.access_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_yv_admin()));

-- ───────────── helpers ─────────────
create or replace function private.role_fits_org(p_type public.user_type, p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organizations o
    where o.id = p_org and o.deleted_at is null
      and ((o.type = 'yv' and p_type in ('yv_admin','yv_team'))
        or (o.type = 'investor' and p_type = 'investor')
        or (o.type = 'startup' and p_type = 'founder')))
$$;

-- Creates the profile and membership. Never changes an existing profile or membership
-- (v1 allows one organization per user).
create or replace function private.provision_user(p_user uuid, p_email text, p_name text, p_org uuid, p_type public.user_type, p_org_admin boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles (id, email, full_name, user_type)
  values (p_user, lower(p_email), coalesce(p_name, ''), p_type)
  on conflict (id) do nothing;
  insert into public.organization_members (org_id, user_id, is_org_admin)
  values (p_org, p_user, p_org_admin)
  on conflict (user_id) do nothing;
end $$;

create or replace function private.notify_admins_kind(p_kind text, p_params jsonb, p_link text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link, kind, params)
  select p.id, p_kind, p_params->>'org', p_link, p_kind, coalesce(p_params, '{}')
  from public.user_profiles p
  join public.organization_members m on m.user_id = p.id and m.is_active
  where p.user_type = 'yv_admin'
$$;

-- Applies an open pre-approval to a confirmed account. Returns true when access was granted.
create or replace function private.apply_access_grant(p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare u record; g record; v_name text;
begin
  select id, email, email_confirmed_at, raw_user_meta_data into u from auth.users where id = p_user;
  if u.id is null or u.email is null or u.email_confirmed_at is null then return false; end if;
  if exists (select 1 from public.user_profiles where id = u.id) then return false; end if;
  select * into g from public.access_grants where email = lower(u.email) and used_at is null for update;
  if g.id is null then return false; end if;
  v_name := coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), g.full_name, '');
  perform private.provision_user(u.id, u.email, v_name, g.org_id, g.user_type, g.is_org_admin);
  update public.access_grants set used_by = u.id, used_at = now() where id = g.id;
  update public.access_requests set status = 'approved', decided_by = g.granted_by, decided_at = now(), updated_at = now()
    where user_id = u.id and status = 'pending';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (g.granted_by, 'access.granted_by_email', 'organization', g.org_id, jsonb_build_object('user_id', u.id, 'user_type', g.user_type));
  return true;
end $$;

-- ───────────── new accounts ─────────────
-- Runs when an account is created or its email becomes confirmed. Metadata from the sign-up form or
-- the identity provider is only stored as request information; it never grants anything.
create or replace function private.on_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare meta jsonb := coalesce(new.raw_user_meta_data, '{}'); v_name text; v_role text;
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  if exists (select 1 from public.user_profiles where id = new.id) then return new; end if;
  if private.apply_access_grant(new.id) then return new; end if;

  v_name := left(coalesce(nullif(meta->>'full_name', ''), nullif(meta->>'name', ''), ''), 200);
  v_role := case when meta->>'requested_role' in ('investor','founder','yv') then meta->>'requested_role' end;
  insert into public.access_requests (user_id, email, full_name, provider, requested_role, organization_name, message)
  values (new.id, lower(new.email), v_name, coalesce(new.raw_app_meta_data->>'provider', 'email'), v_role,
          left(nullif(meta->>'organization_name', ''), 200), left(nullif(meta->>'message', ''), 1000))
  on conflict (user_id) do nothing;
  if found then
    perform private.notify_admins_kind('access_requested', jsonb_build_object('org', coalesce(nullif(v_name, ''), lower(new.email))), '/admin/team#requests');
  end if;
  return new;
end $$;
create trigger on_auth_user_access after insert or update of email_confirmed_at on auth.users
  for each row execute function private.on_auth_user();

-- Pre-approvals must name a role that fits the organization.
create or replace function private.on_access_grant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.role_fits_org(new.user_type, new.org_id) then
    raise exception 'Role does not match the organization type' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger guard before insert on public.access_grants for each row execute function private.on_access_grant();

-- A pre-approval added for someone who already signed up (and confirmed) applies immediately.
create or replace function private.after_access_grant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select u.id into v_user from auth.users u where lower(u.email) = new.email and u.email_confirmed_at is not null limit 1;
  if v_user is not null then perform private.apply_access_grant(v_user); end if;
  return null;
end $$;
create trigger apply_now after insert on public.access_grants for each row execute function private.after_access_grant();

-- ───────────── RPCs ─────────────
-- Applicant: complete or change their own pending request (role, organization, message).
create or replace function public.submit_access_request(p_role text, p_organization text, p_message text, p_full_name text)
returns boolean language sql security definer set search_path = '' as $$
  update public.access_requests
  set requested_role = case when p_role in ('investor','founder','yv') then p_role end,
      organization_name = left(nullif(trim(p_organization), ''), 200),
      message = left(nullif(trim(p_message), ''), 1000),
      full_name = coalesce(left(nullif(trim(p_full_name), ''), 200), full_name),
      updated_at = now()
  where user_id = auth.uid() and status = 'pending'
  returning true
$$;

-- YV admin: approve with a role and an organization of the matching type.
create or replace function public.approve_access_request(p_user uuid, p_org uuid, p_type public.user_type, p_org_admin boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if not private.is_yv_admin() then raise exception 'Only YV admins can approve access' using errcode = '42501'; end if;
  if not private.role_fits_org(p_type, p_org) then raise exception 'Role does not match the organization type' using errcode = '23514'; end if;
  select * into r from public.access_requests where user_id = p_user and status = 'pending' for update;
  if r.user_id is null then return false; end if;
  if exists (select 1 from public.user_profiles where id = p_user) then return false; end if;
  perform private.provision_user(r.user_id, r.email, r.full_name, p_org, p_type, coalesce(p_org_admin, false));
  update public.access_requests set status = 'approved', decided_by = auth.uid(), decided_at = now(), updated_at = now() where user_id = p_user;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'access.approved', 'organization', p_org, jsonb_build_object('user_id', p_user, 'user_type', p_type));
  return true;
end $$;

create or replace function public.decline_access_request(p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_yv_admin() then raise exception 'Only YV admins can decline access' using errcode = '42501'; end if;
  update public.access_requests set status = 'declined', decided_by = auth.uid(), decided_at = now(), updated_at = now()
  where user_id = p_user and status = 'pending';
  if not found then return false; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'access.declined', 'user', p_user, '{}');
  return true;
end $$;

revoke execute on function private.role_fits_org, private.provision_user, private.notify_admins_kind, private.apply_access_grant,
  private.on_auth_user, private.on_access_grant, private.after_access_grant from anon, public, authenticated;
revoke execute on function public.submit_access_request, public.approve_access_request, public.decline_access_request from anon, public;
grant execute on function public.submit_access_request, public.approve_access_request, public.decline_access_request to authenticated;
