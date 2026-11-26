-- YV Platform — authorization: helpers, RLS policies, guard triggers, RPCs

create schema if not exists private;
grant usage on schema private to authenticated;

-- ───────────── helpers (security definer, read-only) ─────────────
create or replace function private.current_user_type() returns public.user_type
language sql stable security definer set search_path = '' as $$
  select p.user_type from public.user_profiles p
  join public.organization_members m on m.user_id = p.id and m.is_active
  where p.id = auth.uid()
$$;

create or replace function private.my_org_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.org_id from public.organization_members m
  where m.user_id = auth.uid() and m.is_active
$$;

create or replace function private.is_yv_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_user_type() in ('yv_admin','yv_team'), false)
$$;

create or replace function private.is_yv_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_user_type() = 'yv_admin', false)
$$;

create or replace function private.is_org_admin_of(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members m
    where m.user_id = auth.uid() and m.is_active and m.is_org_admin and m.org_id = org)
$$;

create or replace function private.my_investor_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select i.id from public.investors i
  where private.current_user_type() = 'investor' and i.org_id = private.my_org_id()
$$;

create or replace function private.my_startup_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.startups s
  where private.current_user_type() = 'founder' and s.org_id = private.my_org_id() and s.deleted_at is null
$$;

create or replace function private.investor_can_see_opportunity(opp uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.current_user_type() = 'investor' and exists (
    select 1 from public.opportunity_access a
    join public.investment_opportunities o on o.id = a.opportunity_id
    where a.opportunity_id = opp and a.investor_org_id = private.my_org_id()
      and o.status in ('shared','paused','closed'))
$$;

grant execute on all functions in schema private to authenticated;
revoke execute on all functions in schema private from anon, public;

-- ───────────── enable RLS everywhere ─────────────
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ───────────── identity ─────────────
create policy roles_read on public.roles for select to authenticated using (true);

create policy org_read on public.organizations for select to authenticated
  using (private.is_yv_staff() or id = private.my_org_id());
create policy org_insert on public.organizations for insert to authenticated
  with check (private.is_yv_staff());
create policy org_update on public.organizations for update to authenticated
  using (private.is_yv_staff() or private.is_org_admin_of(id))
  with check (private.is_yv_staff() or private.is_org_admin_of(id));
create policy org_delete on public.organizations for delete to authenticated
  using (private.is_yv_admin());

create policy profile_read on public.user_profiles for select to authenticated
  using (id = auth.uid() or private.is_yv_staff() or exists (
    select 1 from public.organization_members m where m.user_id = user_profiles.id and m.org_id = private.my_org_id()));
create policy profile_update on public.user_profiles for update to authenticated
  using (id = auth.uid() or private.is_yv_admin())
  with check (id = auth.uid() or private.is_yv_admin());
create policy profile_insert on public.user_profiles for insert to authenticated
  with check (private.is_yv_admin());

create policy member_read on public.organization_members for select to authenticated
  using (private.is_yv_staff() or org_id = private.my_org_id());
create policy member_insert on public.organization_members for insert to authenticated
  with check (private.is_yv_admin());
create policy member_update on public.organization_members for update to authenticated
  using (private.is_yv_admin() or (private.is_org_admin_of(org_id) and user_id <> auth.uid()))
  with check (private.is_yv_admin() or (private.is_org_admin_of(org_id) and user_id <> auth.uid()));

-- ───────────── investors ─────────────
create policy inv_read on public.investors for select to authenticated
  using (private.is_yv_staff() or id = private.my_investor_id());
create policy inv_insert on public.investors for insert to authenticated
  with check (private.is_yv_staff());
create policy inv_update on public.investors for update to authenticated
  using (private.is_yv_staff() or (id = private.my_investor_id() and private.is_org_admin_of(org_id)))
  with check (private.is_yv_staff() or (id = private.my_investor_id() and private.is_org_admin_of(org_id)));
create policy inv_delete on public.investors for delete to authenticated using (private.is_yv_admin());

create policy invpref_read on public.investor_preferences for select to authenticated
  using (private.is_yv_staff() or investor_id = private.my_investor_id());
create policy invpref_write on public.investor_preferences for all to authenticated
  using (private.is_yv_staff() or (investor_id = private.my_investor_id() and private.is_org_admin_of(private.my_org_id())))
  with check (private.is_yv_staff() or (investor_id = private.my_investor_id() and private.is_org_admin_of(private.my_org_id())));

create policy invcontact_read on public.investor_contacts for select to authenticated
  using (private.is_yv_staff() or investor_id = private.my_investor_id());
create policy invcontact_write on public.investor_contacts for all to authenticated
  using (private.is_yv_staff() or (investor_id = private.my_investor_id() and private.is_org_admin_of(private.my_org_id())))
  with check (private.is_yv_staff() or (investor_id = private.my_investor_id() and private.is_org_admin_of(private.my_org_id())));

create policy invrel_staff on public.investor_relationships for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

-- ───────────── startups ─────────────
create policy st_read on public.startups for select to authenticated
  using (private.is_yv_staff() or id = private.my_startup_id());
create policy st_insert on public.startups for insert to authenticated
  with check (private.is_yv_staff());
create policy st_update on public.startups for update to authenticated
  using (private.is_yv_staff() or id = private.my_startup_id())
  with check (private.is_yv_staff() or id = private.my_startup_id());
create policy st_delete on public.startups for delete to authenticated using (private.is_yv_admin());

create policy stf_read on public.startup_founders for select to authenticated
  using (private.is_yv_staff() or startup_id = private.my_startup_id());
create policy stf_write on public.startup_founders for all to authenticated
  using (private.is_yv_staff() or startup_id = private.my_startup_id())
  with check (private.is_yv_staff() or startup_id = private.my_startup_id());

create policy stm_read on public.startup_metrics for select to authenticated
  using (private.is_yv_staff() or startup_id = private.my_startup_id());
create policy stm_insert on public.startup_metrics for insert to authenticated
  with check (private.is_yv_staff() or (startup_id = private.my_startup_id() and verification = 'founder_submitted' and created_by = auth.uid()));
create policy stm_update on public.startup_metrics for update to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());
create policy stm_delete on public.startup_metrics for delete to authenticated using (private.is_yv_admin());

create policy stfr_read on public.startup_fundraising for select to authenticated
  using (private.is_yv_staff() or startup_id = private.my_startup_id());
create policy stfr_insert on public.startup_fundraising for insert to authenticated
  with check (private.is_yv_staff() or (startup_id = private.my_startup_id() and verification = 'founder_submitted' and created_by = auth.uid()));
create policy stfr_update on public.startup_fundraising for update to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

create policy std_read on public.startup_documents for select to authenticated
  using (private.is_yv_staff() or startup_id = private.my_startup_id());
create policy std_insert on public.startup_documents for insert to authenticated
  with check (private.is_yv_staff() or (startup_id = private.my_startup_id() and status = 'submitted' and uploaded_by = auth.uid()));
create policy std_update on public.startup_documents for update to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());
create policy std_delete on public.startup_documents for delete to authenticated using (private.is_yv_admin());

create policy strt_read on public.startup_readiness_tasks for select to authenticated
  using (private.is_yv_staff() or startup_id = private.my_startup_id());
create policy strt_insert on public.startup_readiness_tasks for insert to authenticated
  with check (private.is_yv_staff());
create policy strt_update on public.startup_readiness_tasks for update to authenticated
  using (private.is_yv_staff() or startup_id = private.my_startup_id())
  with check (private.is_yv_staff() or startup_id = private.my_startup_id());
create policy strt_delete on public.startup_readiness_tasks for delete to authenticated using (private.is_yv_staff());

create policy stsh_staff on public.startup_status_history for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

create policy streq_read on public.startup_requests for select to authenticated
  using (private.is_yv_staff() or startup_id = private.my_startup_id());
create policy streq_insert on public.startup_requests for insert to authenticated
  with check (private.is_yv_staff());
create policy streq_update on public.startup_requests for update to authenticated
  using (private.is_yv_staff() or startup_id = private.my_startup_id())
  with check (private.is_yv_staff() or startup_id = private.my_startup_id());

create policy streqr_read on public.startup_request_responses for select to authenticated
  using (private.is_yv_staff() or exists (select 1 from public.startup_requests r
    where r.id = request_id and r.startup_id = private.my_startup_id()));
create policy streqr_insert on public.startup_request_responses for insert to authenticated
  with check (author_id = auth.uid() and (private.is_yv_staff() or exists (select 1 from public.startup_requests r
    where r.id = request_id and r.startup_id = private.my_startup_id())));

-- ───────────── opportunities ─────────────
create policy opp_read on public.investment_opportunities for select to authenticated
  using (private.is_yv_staff() or private.investor_can_see_opportunity(id));
create policy opp_insert on public.investment_opportunities for insert to authenticated
  with check (private.is_yv_staff() and status in ('draft','internal_review'));
create policy opp_update on public.investment_opportunities for update to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());
create policy opp_delete on public.investment_opportunities for delete to authenticated using (private.is_yv_admin());

create policy oacc_read on public.opportunity_access for select to authenticated
  using (private.is_yv_staff() or (investor_org_id = private.my_org_id() and private.investor_can_see_opportunity(opportunity_id)));
create policy oacc_insert on public.opportunity_access for insert to authenticated
  with check (private.is_yv_admin());
create policy oacc_delete on public.opportunity_access for delete to authenticated
  using (private.is_yv_admin());

create policy odoc_staff on public.opportunity_documents for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

create policy osh_staff on public.opportunity_status_history for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

create policy int_read on public.investor_interests for select to authenticated
  using (private.is_yv_staff() or (investor_org_id = private.my_org_id() and private.investor_can_see_opportunity(opportunity_id)));
create policy int_insert on public.investor_interests for insert to authenticated
  with check (private.is_yv_staff() or (investor_org_id = private.my_org_id() and private.investor_can_see_opportunity(opportunity_id) and submitted_by = auth.uid()));
create policy int_update on public.investor_interests for update to authenticated
  using (private.is_yv_staff() or (investor_org_id = private.my_org_id() and private.investor_can_see_opportunity(opportunity_id)))
  with check (private.is_yv_staff() or (investor_org_id = private.my_org_id() and private.investor_can_see_opportunity(opportunity_id)));
create policy int_delete on public.investor_interests for delete to authenticated using (private.is_yv_admin());

-- ───────────── diligence ─────────────
create policy ddq_read on public.due_diligence_requests for select to authenticated
  using (private.is_yv_staff() or (investor_org_id = private.my_org_id() and private.investor_can_see_opportunity(opportunity_id)));
create policy ddq_insert on public.due_diligence_requests for insert to authenticated
  with check (private.is_yv_staff() or (investor_org_id = private.my_org_id() and private.investor_can_see_opportunity(opportunity_id)
    and asked_by = auth.uid() and status = 'open'));
create policy ddq_update on public.due_diligence_requests for update to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

create policy ddr_read on public.due_diligence_responses for select to authenticated
  using (private.is_yv_staff() or (approved_for_release and exists (select 1 from public.due_diligence_requests q
    where q.id = request_id and q.investor_org_id = private.my_org_id() and private.investor_can_see_opportunity(q.opportunity_id))));
create policy ddr_write on public.due_diligence_responses for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

-- ───────────── meetings / internal ─────────────
create policy mtg_read on public.meetings for select to authenticated
  using (private.is_yv_staff()
    or (visible_to_investor and investor_org_id = private.my_org_id() and private.current_user_type() = 'investor')
    or (visible_to_startup and startup_id = private.my_startup_id()));
create policy mtg_insert on public.meetings for insert to authenticated
  with check (private.is_yv_staff()
    or (private.current_user_type() = 'investor' and investor_org_id = private.my_org_id()
        and status = 'requested' and visible_to_investor and requested_by = auth.uid() and startup_id is null
        and (opportunity_id is null or private.investor_can_see_opportunity(opportunity_id))));
create policy mtg_update on public.meetings for update to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());
create policy mtg_delete on public.meetings for delete to authenticated using (private.is_yv_staff());

create policy mtgp_read on public.meeting_participants for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id));  -- inherits meetings RLS
create policy mtgp_write on public.meeting_participants for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

create policy mtgn_staff on public.meeting_notes for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());
create policy fu_staff on public.follow_ups for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());
create policy notes_staff on public.notes for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_read on public.audit_logs for select to authenticated using (private.is_yv_admin());
create policy dal_read on public.document_access_logs for select to authenticated using (private.is_yv_admin());

create policy kpi_read on public.program_kpi_targets for select to authenticated using (private.is_yv_staff());
create policy kpi_update on public.program_kpi_targets for update to authenticated
  using (private.is_yv_admin()) with check (private.is_yv_admin());

-- ───────────── guard triggers ─────────────
create or replace function private.guard_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_yv_admin()
     and (new.user_type is distinct from old.user_type or new.email is distinct from old.email or new.id is distinct from old.id) then
    raise exception 'Only YV admins can change user type or email';
  end if;
  return new;
end $$;
create trigger guard before update on public.user_profiles for each row execute function private.guard_profile();

create or replace function private.guard_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_yv_admin()
     and (new.org_id is distinct from old.org_id or new.user_id is distinct from old.user_id) then
    raise exception 'Only YV admins can move members between organizations';
  end if;
  return new;
end $$;
create trigger guard before update on public.organization_members for each row execute function private.guard_member();

create or replace function private.guard_startup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_yv_staff() and (
       new.stage is distinct from old.stage or new.is_portfolio is distinct from old.is_portfolio
    or new.owner_id is distinct from old.owner_id or new.source is distinct from old.source
    or new.org_id is distinct from old.org_id or new.deleted_at is distinct from old.deleted_at) then
    raise exception 'These fields are managed by YV';
  end if;
  if new.stage is distinct from old.stage then
    insert into public.startup_status_history (startup_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, auth.uid());
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'startup.stage_changed', 'startup', new.id, jsonb_build_object('from', old.stage, 'to', new.stage));
  end if;
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
create trigger guard before update on public.startups for each row execute function private.guard_startup();

create or replace function private.guard_opportunity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('approved','shared','closed','withdrawn') and auth.uid() is not null and not private.is_yv_admin() then
      raise exception 'Only a YV admin can approve, share, close or withdraw an opportunity';
    end if;
    if new.status = 'approved' then new.approved_by = auth.uid(); new.approved_at = now(); end if;
    if new.status = 'shared' and old.status not in ('approved','paused') then
      raise exception 'An opportunity must be approved before it is shared';
    end if;
    if new.status = 'shared' and new.shared_at is null then new.shared_at = now(); end if;
    insert into public.opportunity_status_history (opportunity_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'opportunity.status_changed', 'opportunity', new.id, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
create trigger guard before update on public.investment_opportunities for each row execute function private.guard_opportunity();

create or replace function private.audit_access() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    r := new;
    if not exists (select 1 from public.investment_opportunities o where o.id = new.opportunity_id and o.status in ('approved','shared','paused')) then
      raise exception 'Access can only be granted to approved opportunities';
    end if;
    if not exists (select 1 from public.organizations g where g.id = new.investor_org_id and g.type = 'investor') then
      raise exception 'Access can only be granted to investor organizations';
    end if;
  else r := old; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when tg_op = 'INSERT' then 'opportunity.access_granted' else 'opportunity.access_revoked' end,
          'opportunity', r.opportunity_id, jsonb_build_object('investor_org_id', r.investor_org_id));
  return r;
end $$;
create trigger audit_access before insert or delete on public.opportunity_access for each row execute function private.audit_access();

create or replace function private.guard_dd_response() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.approved_for_release and (tg_op = 'INSERT' or not old.approved_for_release) then
    new.approved_by = auth.uid(); new.approved_at = now();
    update public.due_diligence_requests set status = 'released' where id = new.request_id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'diligence.response_released', 'diligence_request', new.request_id);
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.due_diligence_responses for each row execute function private.guard_dd_response();

create or replace function private.audit_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'member.' || lower(tg_op), 'organization', coalesce(new.org_id, old.org_id),
          jsonb_build_object('user_id', coalesce(new.user_id, old.user_id), 'is_active', new.is_active, 'is_org_admin', new.is_org_admin));
  return coalesce(new, old);
end $$;
create trigger audit_member after insert or update or delete on public.organization_members for each row execute function private.audit_member();

-- ───────────── RPCs callable by the app ─────────────
create or replace function public.log_audit(p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  select auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}')
  where private.current_user_type() is not null
$$;

create or replace function public.notify_staff(p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link)
  select p.id, p_title, p_body, p_link from public.user_profiles p
  join public.organization_members m on m.user_id = p.id and m.is_active
  where p.user_type in ('yv_admin','yv_team') and private.current_user_type() is not null
$$;

create or replace function public.notify_org(p_org uuid, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link)
  select m.user_id, p_title, p_body, p_link from public.organization_members m
  where m.org_id = p_org and m.is_active and private.is_yv_staff()
$$;

-- curated startup card for investors (no internal fields)
create or replace function public.investor_startup_card(p_opportunity uuid)
returns table (name text, website text, logo_url text, country text, sector text, one_liner text, founded_year int, team_size int)
language sql stable security definer set search_path = '' as $$
  select s.name, s.website, s.logo_url, s.country, s.sector, s.one_liner, s.founded_year, s.team_size
  from public.investment_opportunities o join public.startups s on s.id = o.startup_id
  where o.id = p_opportunity and (private.is_yv_staff() or private.investor_can_see_opportunity(o.id))
$$;

create or replace function public.investor_opportunity_documents(p_opportunity uuid)
returns table (id uuid, title text, doc_type text, mime_type text, size_bytes bigint, added_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, d.title, d.doc_type, d.mime_type, d.size_bytes, od.created_at
  from public.opportunity_documents od join public.startup_documents d on d.id = od.document_id
  where od.opportunity_id = p_opportunity and (private.is_yv_staff() or private.investor_can_see_opportunity(p_opportunity))
  order by od.created_at
$$;

create or replace function public.can_access_document(p_document uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_yv_staff()
    or exists (select 1 from public.startup_documents d where d.id = p_document and d.startup_id = private.my_startup_id())
    or exists (select 1 from public.opportunity_documents od where od.document_id = p_document
               and private.investor_can_see_opportunity(od.opportunity_id))
$$;

-- current session user, for the app shell
create or replace function public.whoami()
returns table (user_id uuid, email text, full_name text, user_type public.user_type, org_id uuid, org_name text, org_type public.org_type, is_org_admin boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.email, p.full_name, p.user_type, o.id, o.name, o.type, m.is_org_admin
  from public.user_profiles p
  join public.organization_members m on m.user_id = p.id and m.is_active
  join public.organizations o on o.id = m.org_id
  where p.id = auth.uid()
$$;

revoke execute on function public.log_audit, public.notify_staff, public.notify_org, public.investor_startup_card,
  public.investor_opportunity_documents, public.can_access_document, public.whoami from anon, public;
grant execute on function public.log_audit, public.notify_staff, public.notify_org, public.investor_startup_card,
  public.investor_opportunity_documents, public.can_access_document, public.whoami to authenticated;
revoke execute on function public.touch_updated_at from anon, public;

-- ───────────── KPI view (RLS applies through security_invoker) ─────────────
create or replace view public.program_kpis with (security_invoker = true) as
select
  (select count(*) from public.investor_relationships where status not in ('identified','researched','inactive','rejected')) as qualified_investors,
  (select count(*) from public.investor_relationships where priority = 'high' and status not in ('inactive','rejected')) as priority_relationships,
  (select count(*) from public.meetings where status = 'completed' and investor_org_id is not null) as substantive_meetings,
  (select count(*) from public.startups where deleted_at is null and stage in ('investment_readiness','internal_approval','approved_for_sharing','investor_outreach','active_investor_interest','co_investment_dd','negotiation','closed')) as investment_ready_startups,
  (select count(*) from public.startups where deleted_at is null and stage in ('co_investment_dd','negotiation','closed')) as diligence_processes,
  (select count(*) from public.investor_relationships where status = 'partnership_signed') as signed_partnerships,
  (select coalesce(sum(indicative_amount), 0) from public.investor_interests where level = 'interested') as potential_interest_usd,
  (select coalesce(sum(indicative_amount), 0) from public.investor_interests where level = 'indicative') as indicative_interest_usd;
revoke all on public.program_kpis from anon;
