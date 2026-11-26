-- Hardening after security-advisor review:
--  • External users can no longer call notify_staff (it let them send arbitrary text/links to staff).
--    Staff notifications for investor/founder actions are now created by triggers with fixed text.
--  • log_audit is staff-only; external users' actions are audited by triggers.

drop function public.notify_staff(text, text, text);

create or replace function public.log_audit(p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  select auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}')
  where private.is_yv_staff()
$$;

create or replace function private.notify_staff(p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link)
  select p.id, p_title, p_body, p_link from public.user_profiles p
  join public.organization_members m on m.user_id = p.id and m.is_active
  where p.user_type in ('yv_admin','yv_team')
$$;
revoke execute on function private.notify_staff from anon, public, authenticated;

create or replace function private.on_external_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org_name text;
begin
  if private.is_yv_staff() then return new; end if;
  select o.name into org_name from public.organizations o where o.id = private.my_org_id();
  if tg_table_name = 'investor_interests' then
    perform private.notify_staff('Investor interest: ' || coalesce(org_name, 'investor'),
      'Interest level: ' || new.level, '/admin/opportunities/' || new.opportunity_id);
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'investor.interest_' || lower(tg_op), 'opportunity', new.opportunity_id, jsonb_build_object('level', new.level));
  elsif tg_table_name = 'due_diligence_requests' then
    perform private.notify_staff('New diligence question from ' || coalesce(org_name, 'investor'), null, '/admin/diligence');
  elsif tg_table_name = 'meetings' then
    perform private.notify_staff('Meeting requested by ' || coalesce(org_name, 'investor'), new.title, '/admin/meetings');
  elsif tg_table_name = 'startup_request_responses' then
    perform private.notify_staff('Founder responded: ' || coalesce(org_name, 'startup'), null, '/admin/diligence');
  elsif tg_table_name = 'startup_documents' then
    perform private.notify_staff('Document uploaded by ' || coalesce(org_name, 'startup'), new.title, '/admin/startups/' || new.startup_id);
  end if;
  return new;
end $$;

create trigger notify_external after insert or update on public.investor_interests for each row execute function private.on_external_action();
create trigger notify_external after insert on public.due_diligence_requests for each row execute function private.on_external_action();
create trigger notify_external after insert on public.meetings for each row execute function private.on_external_action();
create trigger notify_external after insert on public.startup_request_responses for each row execute function private.on_external_action();
create trigger notify_external after insert on public.startup_documents for each row execute function private.on_external_action();
