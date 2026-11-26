-- Performance: row-level security and indexes. No change to who can see or change what.
--
-- 1. Policies called the permission helpers once per row. Wrapping each call in (select ...)
--    lets Postgres evaluate it once per query (an InitPlan). Measured with 20,000 rolled-back
--    rows (tests/perf/rls-bench.sql) before and after; see docs/engineering-report.
-- 2. Public records checked "is this a portfolio company?" per row; now one set lookup.
-- 3. Tables with both a read policy and a FOR ALL write policy evaluated two SELECT policies.
--    The write policies are split into insert/update/delete with identical conditions.
-- 4. Every foreign key gets a covering index (joins, cascades, per-company lookups).

set local search_path = public, extensions;

create or replace function private.portfolio_startup_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.startups s where s.is_portfolio and s.deleted_at is null
$$;
revoke execute on function private.portfolio_startup_ids from anon, public;
grant execute on function private.portfolio_startup_ids to authenticated;

alter policy "audit_read" on public.audit_logs to authenticated using ((select private.is_yv_admin()));
alter policy "dal_read" on public.document_access_logs to authenticated using ((select private.is_yv_admin()));
alter policy "ddq_insert" on public.due_diligence_requests to authenticated with check (((select private.is_yv_staff()) OR ((investor_org_id = (select private.my_org_id())) AND private.investor_can_see_opportunity(opportunity_id) AND (asked_by = (select auth.uid())) AND (status = 'open'::dd_status))));
alter policy "ddq_read" on public.due_diligence_requests to authenticated using (((select private.is_yv_staff()) OR ((investor_org_id = (select private.my_org_id())) AND private.investor_can_see_opportunity(opportunity_id))));
alter policy "ddq_update" on public.due_diligence_requests to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "ddr_read" on public.due_diligence_responses to authenticated using (((select private.is_yv_staff()) OR (approved_for_release AND (EXISTS ( SELECT 1
   FROM due_diligence_requests q
  WHERE ((q.id = due_diligence_responses.request_id) AND (q.investor_org_id = (select private.my_org_id())) AND private.investor_can_see_opportunity(q.opportunity_id)))))));
drop policy ddr_write on public.due_diligence_responses;
create policy ddr_insert on public.due_diligence_responses for insert to authenticated with check ((select private.is_yv_staff()));
create policy ddr_update on public.due_diligence_responses for update to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
create policy ddr_delete on public.due_diligence_responses for delete to authenticated using ((select private.is_yv_staff()));
alter policy "fu_staff" on public.follow_ups to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "opp_delete" on public.investment_opportunities to authenticated using ((select private.is_yv_admin()));
alter policy "opp_insert" on public.investment_opportunities to authenticated with check (((select private.is_yv_staff()) AND (status = ANY (ARRAY['draft'::opportunity_status, 'internal_review'::opportunity_status]))));
alter policy "opp_read" on public.investment_opportunities to authenticated using (((select private.is_yv_staff()) OR private.investor_can_see_opportunity(id)));
alter policy "opp_update" on public.investment_opportunities to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "invcontact_read" on public.investor_contacts to authenticated using (((select private.is_yv_staff()) OR (investor_id = (select private.my_investor_id()))));
drop policy invcontact_write on public.investor_contacts;
create policy invcontact_insert on public.investor_contacts for insert to authenticated with check (((select private.is_yv_staff()) OR ((investor_id = (select private.my_investor_id())) AND (select private.is_org_admin_of(private.my_org_id())))));
create policy invcontact_update on public.investor_contacts for update to authenticated using (((select private.is_yv_staff()) OR ((investor_id = (select private.my_investor_id())) AND (select private.is_org_admin_of(private.my_org_id()))))) with check (((select private.is_yv_staff()) OR ((investor_id = (select private.my_investor_id())) AND (select private.is_org_admin_of(private.my_org_id())))));
create policy invcontact_delete on public.investor_contacts for delete to authenticated using (((select private.is_yv_staff()) OR ((investor_id = (select private.my_investor_id())) AND (select private.is_org_admin_of(private.my_org_id())))));
alter policy "int_delete" on public.investor_interests to authenticated using ((select private.is_yv_admin()));
alter policy "int_insert" on public.investor_interests to authenticated with check (((select private.is_yv_staff()) OR ((investor_org_id = (select private.my_org_id())) AND private.investor_can_see_opportunity(opportunity_id) AND (submitted_by = (select auth.uid())))));
alter policy "int_read" on public.investor_interests to authenticated using (((select private.is_yv_staff()) OR ((investor_org_id = (select private.my_org_id())) AND private.investor_can_see_opportunity(opportunity_id))));
alter policy "int_update" on public.investor_interests to authenticated using (((select private.is_yv_staff()) OR ((investor_org_id = (select private.my_org_id())) AND private.investor_can_see_opportunity(opportunity_id)))) with check (((select private.is_yv_staff()) OR ((investor_org_id = (select private.my_org_id())) AND private.investor_can_see_opportunity(opportunity_id))));
alter policy "invpref_read" on public.investor_preferences to authenticated using (((select private.is_yv_staff()) OR (investor_id = (select private.my_investor_id()))));
drop policy invpref_write on public.investor_preferences;
create policy invpref_insert on public.investor_preferences for insert to authenticated with check (((select private.is_yv_staff()) OR ((investor_id = (select private.my_investor_id())) AND (select private.is_org_admin_of(private.my_org_id())))));
create policy invpref_update on public.investor_preferences for update to authenticated using (((select private.is_yv_staff()) OR ((investor_id = (select private.my_investor_id())) AND (select private.is_org_admin_of(private.my_org_id()))))) with check (((select private.is_yv_staff()) OR ((investor_id = (select private.my_investor_id())) AND (select private.is_org_admin_of(private.my_org_id())))));
create policy invpref_delete on public.investor_preferences for delete to authenticated using (((select private.is_yv_staff()) OR ((investor_id = (select private.my_investor_id())) AND (select private.is_org_admin_of(private.my_org_id())))));
alter policy "invrel_staff" on public.investor_relationships to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "inv_delete" on public.investors to authenticated using ((select private.is_yv_admin()));
alter policy "inv_insert" on public.investors to authenticated with check ((select private.is_yv_staff()));
alter policy "inv_read" on public.investors to authenticated using (((select private.is_yv_staff()) OR (id = (select private.my_investor_id()))));
alter policy "inv_update" on public.investors to authenticated using (((select private.is_yv_staff()) OR ((id = (select private.my_investor_id())) AND private.is_org_admin_of(org_id)))) with check (((select private.is_yv_staff()) OR ((id = (select private.my_investor_id())) AND private.is_org_admin_of(org_id))));
alter policy "mtgn_staff" on public.meeting_notes to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
drop policy mtgp_write on public.meeting_participants;
create policy mtgp_insert on public.meeting_participants for insert to authenticated with check ((select private.is_yv_staff()));
create policy mtgp_update on public.meeting_participants for update to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
create policy mtgp_delete on public.meeting_participants for delete to authenticated using ((select private.is_yv_staff()));
alter policy "mtg_delete" on public.meetings to authenticated using ((select private.is_yv_staff()));
alter policy "mtg_insert" on public.meetings to authenticated with check (((select private.is_yv_staff()) OR (((select private.current_user_type()) = 'investor'::user_type) AND (investor_org_id = (select private.my_org_id())) AND (status = 'requested'::meeting_status) AND visible_to_investor AND (requested_by = (select auth.uid())) AND (startup_id IS NULL) AND ((opportunity_id IS NULL) OR private.investor_can_see_opportunity(opportunity_id)))));
alter policy "mtg_read" on public.meetings to authenticated using (((select private.is_yv_staff()) OR (visible_to_investor AND (investor_org_id = (select private.my_org_id())) AND ((select private.current_user_type()) = 'investor'::user_type)) OR (visible_to_startup AND (startup_id = (select private.my_startup_id())))));
alter policy "mtg_update" on public.meetings to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "notes_staff" on public.notes to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "notif_read" on public.notifications to authenticated using ((user_id = (select auth.uid())));
alter policy "notif_update" on public.notifications to authenticated using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "oacc_delete" on public.opportunity_access to authenticated using ((select private.is_yv_admin()));
alter policy "oacc_insert" on public.opportunity_access to authenticated with check ((select private.is_yv_admin()));
alter policy "oacc_read" on public.opportunity_access to authenticated using (((select private.is_yv_staff()) OR ((investor_org_id = (select private.my_org_id())) AND private.investor_can_see_opportunity(opportunity_id))));
alter policy "odoc_staff" on public.opportunity_documents to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "osh_staff" on public.opportunity_status_history to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "member_insert" on public.organization_members to authenticated with check ((select private.is_yv_admin()));
alter policy "member_read" on public.organization_members to authenticated using (((select private.is_yv_staff()) OR (org_id = (select private.my_org_id()))));
alter policy "member_update" on public.organization_members to authenticated using (((select private.is_yv_admin()) OR (private.is_org_admin_of(org_id) AND (user_id <> (select auth.uid()))))) with check (((select private.is_yv_admin()) OR (private.is_org_admin_of(org_id) AND (user_id <> (select auth.uid())))));
alter policy "org_delete" on public.organizations to authenticated using ((select private.is_yv_admin()));
alter policy "org_insert" on public.organizations to authenticated with check ((select private.is_yv_staff()));
alter policy "org_read" on public.organizations to authenticated using (((select private.is_yv_staff()) OR (id = (select private.my_org_id()))));
alter policy "org_update" on public.organizations to authenticated using (((select private.is_yv_staff()) OR private.is_org_admin_of(id))) with check (((select private.is_yv_staff()) OR private.is_org_admin_of(id)));
alter policy "kpi_read" on public.program_kpi_targets to authenticated using ((select private.is_yv_staff()));
alter policy "kpi_update" on public.program_kpi_targets to authenticated using ((select private.is_yv_admin())) with check ((select private.is_yv_admin()));
alter policy "std_delete" on public.startup_documents to authenticated using ((select private.is_yv_admin()));
alter policy "std_insert" on public.startup_documents to authenticated with check (((select private.is_yv_staff()) OR ((startup_id = (select private.my_startup_id())) AND (status = 'submitted'::doc_status) AND (uploaded_by = (select auth.uid())))));
alter policy "std_read" on public.startup_documents to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
alter policy "std_update" on public.startup_documents to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "stf_read" on public.startup_founders to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
drop policy stf_write on public.startup_founders;
create policy stf_insert on public.startup_founders for insert to authenticated with check (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
create policy stf_update on public.startup_founders for update to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id())))) with check (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
create policy stf_delete on public.startup_founders for delete to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
alter policy "stfr_insert" on public.startup_fundraising to authenticated with check (((select private.is_yv_staff()) OR ((startup_id = (select private.my_startup_id())) AND (verification = 'founder_submitted'::verification_status) AND (created_by = (select auth.uid())))));
alter policy "stfr_read" on public.startup_fundraising to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
alter policy "stfr_update" on public.startup_fundraising to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "stm_delete" on public.startup_metrics to authenticated using ((select private.is_yv_admin()));
alter policy "stm_insert" on public.startup_metrics to authenticated with check (((select private.is_yv_staff()) OR ((startup_id = (select private.my_startup_id())) AND (verification = 'founder_submitted'::verification_status) AND (created_by = (select auth.uid())))));
alter policy "stm_read" on public.startup_metrics to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
alter policy "stm_update" on public.startup_metrics to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "spr_read" on public.startup_public_records to authenticated using (((select private.is_yv_staff()) OR (((select private.current_user_type()) IS NOT NULL) AND (startup_id in (select private.portfolio_startup_ids())))));
drop policy spr_write on public.startup_public_records;
create policy spr_insert on public.startup_public_records for insert to authenticated with check ((select private.is_yv_staff()));
create policy spr_update on public.startup_public_records for update to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
create policy spr_delete on public.startup_public_records for delete to authenticated using ((select private.is_yv_staff()));
alter policy "strt_delete" on public.startup_readiness_tasks to authenticated using ((select private.is_yv_staff()));
alter policy "strt_insert" on public.startup_readiness_tasks to authenticated with check ((select private.is_yv_staff()));
alter policy "strt_read" on public.startup_readiness_tasks to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
alter policy "strt_update" on public.startup_readiness_tasks to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id())))) with check (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
alter policy "streqr_insert" on public.startup_request_responses to authenticated with check (((author_id = (select auth.uid())) AND ((select private.is_yv_staff()) OR (EXISTS ( SELECT 1
   FROM startup_requests r
  WHERE ((r.id = startup_request_responses.request_id) AND (r.startup_id = (select private.my_startup_id()))))))));
alter policy "streqr_read" on public.startup_request_responses to authenticated using (((select private.is_yv_staff()) OR (EXISTS ( SELECT 1
   FROM startup_requests r
  WHERE ((r.id = startup_request_responses.request_id) AND (r.startup_id = (select private.my_startup_id())))))));
alter policy "streq_insert" on public.startup_requests to authenticated with check ((select private.is_yv_staff()));
alter policy "streq_read" on public.startup_requests to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
alter policy "streq_update" on public.startup_requests to authenticated using (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id())))) with check (((select private.is_yv_staff()) OR (startup_id = (select private.my_startup_id()))));
alter policy "sro_staff" on public.startup_round_outlook to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "stsh_staff" on public.startup_status_history to authenticated using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
alter policy "st_delete" on public.startups to authenticated using ((select private.is_yv_admin()));
alter policy "st_insert" on public.startups to authenticated with check ((select private.is_yv_staff()));
alter policy "st_read" on public.startups to authenticated using (((select private.is_yv_staff()) OR (id = (select private.my_startup_id()))));
alter policy "st_update" on public.startups to authenticated using (((select private.is_yv_staff()) OR (id = (select private.my_startup_id())))) with check (((select private.is_yv_staff()) OR (id = (select private.my_startup_id()))));
alter policy "profile_insert" on public.user_profiles to authenticated with check ((select private.is_yv_admin()));
alter policy "profile_read" on public.user_profiles to authenticated using (((id = (select auth.uid())) OR (select private.is_yv_staff()) OR (EXISTS ( SELECT 1
   FROM organization_members m
  WHERE ((m.user_id = user_profiles.id) AND (m.org_id = (select private.my_org_id())))))));
alter policy "profile_update" on public.user_profiles to authenticated using (((id = (select auth.uid())) OR (select private.is_yv_admin()))) with check (((id = (select auth.uid())) OR (select private.is_yv_admin())));
alter policy "docs delete admin" on storage.objects to authenticated using (((bucket_id = 'startup-documents'::text) AND (select private.is_yv_admin())));
alter policy "docs delete own unregistered" on storage.objects to authenticated using (((bucket_id = 'startup-documents'::text) AND ((storage.foldername(name))[1] = ((select private.my_startup_id()))::text) AND (NOT (EXISTS ( SELECT 1
   FROM startup_documents d
  WHERE (d.storage_path = objects.name))))));
alter policy "docs read own unregistered" on storage.objects to authenticated using (((bucket_id = 'startup-documents'::text) AND ((storage.foldername(name))[1] = ((select private.my_startup_id()))::text) AND (NOT (EXISTS ( SELECT 1
   FROM startup_documents d
  WHERE (d.storage_path = objects.name))))));
alter policy "docs upload own startup folder" on storage.objects to authenticated with check (((bucket_id = 'startup-documents'::text) AND ((select private.is_yv_staff()) OR ((storage.foldername(name))[1] = ((select private.my_startup_id()))::text))));

drop function private.is_portfolio_startup(uuid);

-- Covering index for every foreign key in public that has none (names are deterministic).
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname,
           string_agg(quote_ident(a.attname), ', ' order by k.ord) as cols
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] @> c.conkey
          and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] <@ c.conkey)
    group by c.conrelid, c.conname
  loop
    execute format('create index if not exists %I on %s (%s)', left(r.conname || '_idx', 63), r.tbl, r.cols);
  end loop;
end $$;
