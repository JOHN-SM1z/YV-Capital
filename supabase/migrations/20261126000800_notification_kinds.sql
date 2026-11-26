-- Notifications carry a machine-readable kind + params so each recipient sees them in their own
-- language. title/body remain as an English fallback for old rows and other consumers.

alter table public.notifications
  add column kind text,
  add column params jsonb not null default '{}';

create or replace function public.notify_org_kind(p_org uuid, p_kind text, p_params jsonb, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link, kind, params)
  select m.user_id, p_kind, p_params->>'title', p_link, p_kind, coalesce(p_params, '{}')
  from public.organization_members m
  where m.org_id = p_org and m.is_active and private.is_yv_staff()
$$;
revoke execute on function public.notify_org_kind from anon, public;
grant execute on function public.notify_org_kind to authenticated;

create or replace function private.notify_staff_kind(p_kind text, p_params jsonb, p_link text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link, kind, params)
  select p.id, p_kind, p_params->>'title', p_link, p_kind, coalesce(p_params, '{}')
  from public.user_profiles p
  join public.organization_members m on m.user_id = p.id and m.is_active
  where p.user_type in ('yv_admin','yv_team')
$$;
revoke execute on function private.notify_staff_kind from anon, public, authenticated;

create or replace function private.on_external_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org_name text;
begin
  if private.is_yv_staff() then return new; end if;
  select o.name into org_name from public.organizations o where o.id = private.my_org_id();
  if tg_table_name = 'investor_interests' then
    perform private.notify_staff_kind('investor_interest', jsonb_build_object('org', org_name, 'level', new.level), '/admin/opportunities/' || new.opportunity_id);
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'investor.interest_' || lower(tg_op), 'opportunity', new.opportunity_id, jsonb_build_object('level', new.level));
  elsif tg_table_name = 'due_diligence_requests' then
    perform private.notify_staff_kind('dd_question', jsonb_build_object('org', org_name), '/admin/diligence');
  elsif tg_table_name = 'meetings' then
    perform private.notify_staff_kind('meeting_requested', jsonb_build_object('org', org_name, 'title', new.title), '/admin/meetings');
  elsif tg_table_name = 'startup_request_responses' then
    perform private.notify_staff_kind('founder_responded', jsonb_build_object('org', org_name), '/admin/diligence');
  elsif tg_table_name = 'startup_documents' then
    perform private.notify_staff_kind('document_uploaded', jsonb_build_object('org', org_name, 'title', new.title), '/admin/startups/' || new.startup_id);
  end if;
  return new;
end $$;

drop function private.notify_staff(text, text, text);
