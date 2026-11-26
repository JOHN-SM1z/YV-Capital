-- Cross-organization isolation tests. Run as the database owner:
--   pnpm test:rls          (or paste into the Supabase SQL editor)
--
-- Everything runs inside one transaction that is rolled back, so it creates its own fixtures and
-- leaves no data behind. Each check impersonates a test login through request.jwt.claims + the
-- "authenticated" role. The final SELECT lists every check; all rows must have pass = true.
--
-- Requires the test logins from seed-users.template.sql: investor.a/b are in two investor
-- organizations, founder.a/b in two portfolio companies.

begin;

create temp table rls_results (check_name text, expected text, actual text, pass boolean) on commit drop;
create temp table ids (k text primary key, v uuid) on commit drop;
create temp table totals (k text primary key, n bigint) on commit drop;
grant insert, select on rls_results to authenticated, anon;
grant select on ids, totals to authenticated, anon;

create or replace function pg_temp.as_user(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.id(p_key text) returns uuid language sql stable as $$ select v from ids where k = p_key $$;

create or replace function pg_temp.expect(p_name text, p_expected bigint, p_actual bigint) returns void language sql as $$
  insert into rls_results values (p_name, p_expected::text, p_actual::text, p_expected = p_actual)
$$;

-- Passes only if the statement is rejected.
create or replace function pg_temp.expect_error(p_name text, p_sql text) returns void language plpgsql as $$
declare affected bigint;
begin
  execute p_sql;
  get diagnostics affected = row_count;
  -- An UPDATE or DELETE hidden by RLS affects no rows; that also counts as refused.
  insert into rls_results values (p_name, 'refused', affected || ' rows', affected = 0);
exception when others then
  insert into rls_results values (p_name, 'refused', 'refused', true);
end $$;

-- ───────────── fixtures ─────────────
insert into ids
select 'org_inv_a', m.org_id from public.organization_members m join auth.users u on u.id = m.user_id where u.email = 'investor.a@demo.test'
union all select 'org_inv_b', m.org_id from public.organization_members m join auth.users u on u.id = m.user_id where u.email = 'investor.b@demo.test'
union all select 'startup_a', s.id from public.startups s join public.organization_members m on m.org_id = s.org_id join auth.users u on u.id = m.user_id where u.email = 'founder.a@demo.test'
union all select 'startup_b', s.id from public.startups s join public.organization_members m on m.org_id = s.org_id join auth.users u on u.id = m.user_id where u.email = 'founder.b@demo.test';

insert into ids values
  ('opp_a', gen_random_uuid()), ('opp_b', gen_random_uuid()), ('opp_review', gen_random_uuid()),
  ('q_a', gen_random_uuid()), ('q_b', gen_random_uuid()), ('doc_a', gen_random_uuid()),
  ('private_org', gen_random_uuid()), ('private_startup', gen_random_uuid()),
  ('private_record', gen_random_uuid()), ('private_round', gen_random_uuid());

-- A company outside the portfolio, whose records must stay hidden from external users.
insert into public.organizations (id, type, name) values (pg_temp.id('private_org'), 'startup', 'RLS test private company');
insert into public.startups (id, org_id, name, is_portfolio) values (pg_temp.id('private_startup'), pg_temp.id('private_org'), 'RLS test private company', false);
insert into public.startup_public_records (id, startup_id, title, url, publisher, kind, summary)
values (pg_temp.id('private_record'), pg_temp.id('private_startup'), 'Hidden', 'https://example.com/rls-test', 'Test', 'news', 'Must not be visible to external users.');
insert into public.funding_rounds (id, startup_id, amount_usd, source_record_id) values (pg_temp.id('private_round'), pg_temp.id('private_startup'), 1000, pg_temp.id('private_record'));
insert into public.round_participants (round_id, name) values (pg_temp.id('private_round'), 'RLS hidden fund');

insert into public.investment_opportunities (id, startup_id, title, status) values
  (pg_temp.id('opp_a'), pg_temp.id('startup_a'), 'RLS test A', 'shared'),
  (pg_temp.id('opp_b'), pg_temp.id('startup_b'), 'RLS test B', 'shared'),
  (pg_temp.id('opp_review'), pg_temp.id('startup_a'), 'RLS test review', 'internal_review');
insert into public.opportunity_access (opportunity_id, investor_org_id) values
  (pg_temp.id('opp_a'), pg_temp.id('org_inv_a')), (pg_temp.id('opp_b'), pg_temp.id('org_inv_b'));
insert into public.investor_interests (opportunity_id, investor_org_id, level) values
  (pg_temp.id('opp_a'), pg_temp.id('org_inv_a'), 'interested'), (pg_temp.id('opp_b'), pg_temp.id('org_inv_b'), 'interested');
insert into public.due_diligence_requests (id, opportunity_id, investor_org_id, question) values
  (pg_temp.id('q_a'), pg_temp.id('opp_a'), pg_temp.id('org_inv_a'), 'A question'),
  (pg_temp.id('q_b'), pg_temp.id('opp_b'), pg_temp.id('org_inv_b'), 'B question');
insert into public.due_diligence_responses (request_id, body, approved_for_release) values (pg_temp.id('q_a'), 'Unapproved draft', false);
insert into public.startup_requests (startup_id, dd_request_id, title) values (pg_temp.id('startup_a'), pg_temp.id('q_a'), 'RLS test request');
insert into public.meetings (title, investor_org_id, startup_id, visible_to_investor, visible_to_startup, starts_at) values
  ('RLS test shared meeting', pg_temp.id('org_inv_a'), pg_temp.id('startup_a'), true, true, now()),
  ('RLS test internal meeting', pg_temp.id('org_inv_a'), pg_temp.id('startup_a'), false, false, now());
insert into public.notes (entity_type, entity_id, body) values ('startup', pg_temp.id('startup_a'), 'Internal');
insert into public.startup_documents (id, startup_id, doc_type, title, storage_path, mime_type, size_bytes)
values (pg_temp.id('doc_a'), pg_temp.id('startup_a'), 'pitch_deck', 'RLS test deck', pg_temp.id('startup_a') || '/rls-test.pdf', 'application/pdf', 10);
insert into public.startup_metrics (startup_id, metric_key, value, period, source) values (pg_temp.id('startup_a'), 'revenue', 1, 'test', 'test');

insert into totals
select 'investors', count(*) from public.investors
union all select 'startups', count(*) from public.startups
union all select 'portfolio', count(*) from public.startups where is_portfolio and deleted_at is null
union all select 'portfolio_records', count(*) from public.startup_public_records r join public.startups s on s.id = r.startup_id where s.is_portfolio
union all select 'audit', count(*) from public.audit_logs
union all select 'portfolio_rounds', count(*) from public.funding_rounds f join public.startups s on s.id = f.startup_id where s.is_portfolio and s.deleted_at is null
union all select 'portfolio_participants', count(*) from public.round_participants p join public.funding_rounds f on f.id = p.round_id join public.startups s on s.id = f.startup_id where s.is_portfolio and s.deleted_at is null;

-- ───────────── investor A ─────────────
select pg_temp.as_user('investor.a@demo.test');
select pg_temp.expect('investor_sees_only_own_shared_opportunity', 1, count(*)) from public.investment_opportunities;
select pg_temp.expect('investor_cannot_read_opportunity_shared_with_b', 0, count(*)) from public.investment_opportunities where id = pg_temp.id('opp_b');
select pg_temp.expect('investor_cannot_read_internal_review_opportunity', 0, count(*)) from public.investment_opportunities where id = pg_temp.id('opp_review');
select pg_temp.expect('investor_cannot_read_other_org_interest', 1, count(*)) from public.investor_interests;
select pg_temp.expect('investor_cannot_see_other_orgs_access_rows', 1, count(*)) from public.opportunity_access;
select pg_temp.expect('investor_cannot_read_other_org_questions', 1, count(*)) from public.due_diligence_requests;
select pg_temp.expect('investor_cannot_read_unapproved_response', 0, count(*)) from public.due_diligence_responses;
select pg_temp.expect('investor_cannot_read_internal_notes', 0, count(*)) from public.notes;
select pg_temp.expect('investor_cannot_read_crm_relationships', 0, count(*)) from public.investor_relationships;
select pg_temp.expect('investor_cannot_read_meeting_notes', 0, count(*)) from public.meeting_notes;
select pg_temp.expect('investor_cannot_read_follow_ups', 0, count(*)) from public.follow_ups;
select pg_temp.expect('investor_sees_only_own_investor_profile', 1, count(*)) from public.investors;
select pg_temp.expect('investor_sees_only_own_organization', 1, count(*)) from public.organizations;
select pg_temp.expect('investor_cannot_read_startups_table', 0, count(*)) from public.startups;
select pg_temp.expect('investor_cannot_read_startup_metrics', 0, count(*)) from public.startup_metrics;
select pg_temp.expect('investor_cannot_read_round_outlook', 0, count(*)) from public.startup_round_outlook;
select pg_temp.expect('investor_sees_only_shared_meeting', 1, count(*)) from public.meetings;
select pg_temp.expect('investor_card_for_shared_opportunity', 1, count(*)) from public.investor_startup_card(pg_temp.id('opp_a'));
select pg_temp.expect('investor_card_blocked_for_unshared_opportunity', 0, count(*)) from public.investor_startup_card(pg_temp.id('opp_b'));
select pg_temp.expect('investor_cannot_read_kpi_targets', 0, count(*)) from public.program_kpi_targets;
select pg_temp.expect('investor_cannot_read_audit_log', 0, count(*)) from public.audit_logs;
select pg_temp.expect('investor_portfolio_directory_lists_portfolio_only', (select n from totals where k = 'portfolio'), count(*)) from public.portfolio_directory();
select pg_temp.expect('investor_reads_every_portfolio_record', (select n from totals where k = 'portfolio_records'), count(*)) from public.startup_public_records;
select pg_temp.expect('investor_cannot_read_non_portfolio_records', 0, count(*)) from public.startup_public_records where startup_id = pg_temp.id('private_startup');
select pg_temp.expect_error('investor_cannot_add_public_record',
  format($q$insert into public.startup_public_records (startup_id, title, url, publisher, kind, summary) values (%L, 'x', 'https://example.com/x', 'x', 'news', 'x')$q$, pg_temp.id('startup_a')));
select pg_temp.expect_error('investor_cannot_edit_public_record', $q$update public.startup_public_records set title = 'hacked'$q$);
-- funding rounds: public facts about portfolio companies only, read-only for external users
select pg_temp.expect('investor_reads_every_portfolio_round', (select n from totals where k = 'portfolio_rounds'), count(*)) from public.funding_rounds;
select pg_temp.expect('investor_reads_every_portfolio_round_participant', (select n from totals where k = 'portfolio_participants'), count(*)) from public.round_participants;
select pg_temp.expect('investor_cannot_read_non_portfolio_rounds', 0, count(*)) from public.funding_rounds where startup_id = pg_temp.id('private_startup');
select pg_temp.expect('investor_cannot_read_non_portfolio_participants', 0, count(*)) from public.round_participants where name = 'RLS hidden fund';
select pg_temp.expect_error('investor_cannot_add_round',
  format($q$insert into public.funding_rounds (startup_id, amount_usd, source_record_id) select %L, 1, id from public.startup_public_records where startup_id = %L limit 1$q$, pg_temp.id('startup_a'), pg_temp.id('startup_a')));
select pg_temp.expect_error('investor_cannot_edit_round_participants', $q$update public.round_participants set name = 'hacked'$q$);
-- follows (watchlist)
insert into public.company_follows (startup_id) values (pg_temp.id('startup_a'));
select pg_temp.expect('investor_can_follow_portfolio_company', 1, count(*)) from public.company_follows;
select pg_temp.expect_error('investor_cannot_follow_non_portfolio_company',
  format($q$insert into public.company_follows (startup_id) values (%L)$q$, pg_temp.id('private_startup')));
select pg_temp.expect_error('investor_cannot_follow_for_another_user',
  format($q$insert into public.company_follows (user_id, startup_id) values ((select id from auth.users where email = 'investor.b@demo.test'), %L)$q$, pg_temp.id('startup_b')));
select pg_temp.expect_error('investor_cannot_express_interest_in_unshared_opportunity',
  format($q$insert into public.investor_interests (opportunity_id, investor_org_id, level, submitted_by) values (%L, %L, 'interested', auth.uid())$q$, pg_temp.id('opp_b'), pg_temp.id('org_inv_a')));
select pg_temp.expect_error('investor_cannot_write_as_other_org',
  format($q$insert into public.investor_interests (opportunity_id, investor_org_id, level, submitted_by) values (%L, %L, 'declined', auth.uid())$q$, pg_temp.id('opp_a'), pg_temp.id('org_inv_b')));
select pg_temp.expect_error('investor_cannot_approve_own_answer', $q$update public.due_diligence_responses set approved_for_release = true$q$);
select pg_temp.expect('investor_cannot_access_document_outside_data_room', 0, case when public.can_access_document(pg_temp.id('doc_a')) then 1 else 0 end);
select pg_temp.expect('investor_gets_no_path_for_inaccessible_document', 0, count(public.document_storage_path(pg_temp.id('doc_a'))));
-- Free-text notification RPCs must not let an external user write to another organization.
select public.notify_org_kind(pg_temp.id('org_inv_b'), 'new_request', '{"title":"spoof"}', '/investor');
reset role;
select pg_temp.expect('investor_cannot_send_notifications', 0, count(*)) from public.notifications where params->>'title' = 'spoof';

-- document added to A's data room
insert into public.opportunity_documents (opportunity_id, document_id) values (pg_temp.id('opp_a'), pg_temp.id('doc_a'));
select pg_temp.as_user('investor.a@demo.test');
select pg_temp.expect('investor_can_access_data_room_document', 1, case when public.can_access_document(pg_temp.id('doc_a')) then 1 else 0 end);
reset role;

-- ───────────── investor B ─────────────
select pg_temp.as_user('investor.b@demo.test');
select pg_temp.expect('investor_b_cannot_read_a_opportunity', 0, count(*)) from public.investment_opportunities where id = pg_temp.id('opp_a');
select pg_temp.expect('investor_b_sees_own_opportunity', 1, count(*)) from public.investment_opportunities;
select pg_temp.expect('investor_b_cannot_read_a_questions', 0, count(*)) from public.due_diligence_requests where id = pg_temp.id('q_a');
select pg_temp.expect('investor_b_cannot_see_a_users', 1, count(*)) from public.user_profiles;
select pg_temp.expect('investor_b_cannot_access_a_data_room', 0, case when public.can_access_document(pg_temp.id('doc_a')) then 1 else 0 end);
select pg_temp.expect('investor_b_cannot_see_a_follows', 0, count(*)) from public.company_follows;
select pg_temp.expect_error('investor_b_cannot_remove_a_follow', $q$delete from public.company_follows$q$);
reset role;

-- ───────────── founder A ─────────────
select pg_temp.as_user('founder.a@demo.test');
select pg_temp.expect('founder_sees_only_own_startup', 1, count(*)) from public.startups;
select pg_temp.expect('founder_cannot_read_opportunities', 0, count(*)) from public.investment_opportunities;
select pg_temp.expect('founder_cannot_read_investor_questions', 0, count(*)) from public.due_diligence_requests;
select pg_temp.expect('founder_cannot_read_investor_interests', 0, count(*)) from public.investor_interests;
select pg_temp.expect('founder_cannot_read_investors', 0, count(*)) from public.investors;
select pg_temp.expect('founder_sees_request_routed_to_company', 1, count(*)) from public.startup_requests where title = 'RLS test request';
select pg_temp.expect('founder_sees_only_meeting_shared_with_company', 1, count(*)) from public.meetings;
select pg_temp.expect('founder_cannot_read_status_history', 0, count(*)) from public.startup_status_history;
select pg_temp.expect('founder_cannot_read_round_outlook', 0, count(*)) from public.startup_round_outlook;
select pg_temp.expect('founder_cannot_read_internal_notes', 0, count(*)) from public.notes;
select pg_temp.expect('founder_cannot_read_non_portfolio_records', 0, count(*)) from public.startup_public_records where startup_id = pg_temp.id('private_startup');
select pg_temp.expect_error('founder_cannot_change_pipeline_stage', format($q$update public.startups set stage = 'closed' where id = %L$q$, pg_temp.id('startup_a')));
select pg_temp.expect_error('founder_cannot_change_yv_check', format($q$update public.startups set yv_check_usd = 1, is_portfolio = false where id = %L$q$, pg_temp.id('startup_a')));
select pg_temp.expect_error('founder_cannot_self_verify_metric',
  format($q$insert into public.startup_metrics (startup_id, metric_key, value, period, source, verification, created_by) values (%L, 'revenue', 1, 'x', 'x', 'yv_verified', auth.uid())$q$, pg_temp.id('startup_a')));
select pg_temp.expect_error('founder_cannot_add_public_record',
  format($q$insert into public.startup_public_records (startup_id, title, url, publisher, kind, summary) values (%L, 'x', 'https://example.com/y', 'x', 'news', 'x')$q$, pg_temp.id('startup_a')));
select pg_temp.expect('founder_can_access_own_document', 1, case when public.can_access_document(pg_temp.id('doc_a')) then 1 else 0 end);
select pg_temp.expect('founder_cannot_see_who_follows_company', 0, count(*)) from public.company_follows;
select pg_temp.expect('founder_cannot_read_non_portfolio_rounds', 0, count(*)) from public.funding_rounds where startup_id = pg_temp.id('private_startup');
select pg_temp.expect_error('founder_cannot_follow', format($q$insert into public.company_follows (startup_id) values (%L)$q$, pg_temp.id('startup_b')));
select pg_temp.expect_error('founder_cannot_add_round',
  format($q$insert into public.funding_rounds (startup_id, amount_usd, source_record_id) select %L, 1, id from public.startup_public_records where startup_id = %L limit 1$q$, pg_temp.id('startup_a'), pg_temp.id('startup_a')));
reset role;

-- ───────────── founder B ─────────────
select pg_temp.as_user('founder.b@demo.test');
select pg_temp.expect('founder_b_cannot_read_a_startup', 0, count(*)) from public.startups where id = pg_temp.id('startup_a');
select pg_temp.expect('founder_b_cannot_read_a_metrics', 0, count(*)) from public.startup_metrics where startup_id = pg_temp.id('startup_a');
select pg_temp.expect('founder_b_cannot_read_a_requests', 0, count(*)) from public.startup_requests where startup_id = pg_temp.id('startup_a');
select pg_temp.expect('founder_b_cannot_access_a_document', 0, case when public.can_access_document(pg_temp.id('doc_a')) then 1 else 0 end);
reset role;

-- ───────────── YV team (not admin) ─────────────
select pg_temp.as_user('team@yv.demo');
select pg_temp.expect('team_sees_all_investors', (select n from totals where k = 'investors'), count(*)) from public.investors;
select pg_temp.expect('team_sees_all_startups', (select n from totals where k = 'startups'), count(*)) from public.startups;
select pg_temp.expect('team_cannot_read_audit_log', 0, count(*)) from public.audit_logs;
select pg_temp.expect_error('team_cannot_approve_opportunity', format($q$update public.investment_opportunities set status = 'approved' where id = %L$q$, pg_temp.id('opp_review')));
select pg_temp.expect_error('team_cannot_grant_investor_access',
  format($q$insert into public.opportunity_access (opportunity_id, investor_org_id) values (%L, %L)$q$, pg_temp.id('opp_a'), pg_temp.id('org_inv_b')));
select pg_temp.expect_error('team_cannot_make_itself_admin', $q$update public.user_profiles set user_type = 'yv_admin' where id = auth.uid()$q$);
select pg_temp.expect('team_sees_investor_follows', 1, count(*)) from public.company_follows where startup_id = pg_temp.id('startup_a');
select pg_temp.expect_error('round_must_cite_own_company_record',
  format($q$insert into public.funding_rounds (startup_id, amount_usd, source_record_id) values (%L, 1, %L)$q$, pg_temp.id('startup_a'), pg_temp.id('private_record')));
-- A new record on a followed company alerts the follower (investor A), nobody else.
insert into public.startup_public_records (startup_id, title, url, publisher, kind, summary)
values (pg_temp.id('startup_a'), 'RLS alert test', 'https://example.com/rls-alert', 'Test', 'news', 'Alert test');
reset role;

select pg_temp.expect('follower_gets_alert_for_new_record', 1, count(*)) from public.notifications n join auth.users u on u.id = n.user_id
  where u.email = 'investor.a@demo.test' and n.kind = 'followed_record' and n.params->>'title' = 'RLS alert test';
select pg_temp.expect('non_followers_get_no_alert', 0, count(*)) from public.notifications n join auth.users u on u.id = n.user_id
  where u.email <> 'investor.a@demo.test' and n.kind = 'followed_record' and n.params->>'title' = 'RLS alert test';

-- ───────────── YV admin ─────────────
select pg_temp.as_user('admin@yv.demo');
select pg_temp.expect('admin_reads_audit_log', 1, case when count(*) > 0 then 1 else 0 end) from public.audit_logs;
select pg_temp.expect_error('nobody_can_share_before_approval', format($q$update public.investment_opportunities set status = 'shared' where id = %L$q$, pg_temp.id('opp_review')));
reset role;

-- ───────────── self sign-up and pre-approvals ─────────────
create or replace function pg_temp.new_auth_user(p_email text, p_confirmed boolean, p_meta jsonb default '{}') returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
    case when p_confirmed then now() end, '{"provider":"email","providers":["email"]}', p_meta, now(), now(), '', '', '', '');
  return uid;
end $$;

-- Pre-approvals made by an admin before the accounts exist.
insert into public.access_grants (email, org_id, user_type) values
  ('rls-granted@example.com', '00000000-0000-4000-8000-000000000001', 'yv_team'),
  ('rls-unconfirmed@example.com', pg_temp.id('org_inv_a'), 'investor');
insert into ids values
  ('u_pending', pg_temp.new_auth_user('rls-pending@example.com', true, '{"full_name":"RLS Pending","requested_role":"yv","organization_name":"Fake YV"}')),
  ('u_granted', pg_temp.new_auth_user('rls-granted@example.com', true)),
  ('u_unconfirmed', pg_temp.new_auth_user('rls-unconfirmed@example.com', false));

select pg_temp.expect('signup_without_grant_gets_no_profile', 0, count(*)) from public.user_profiles where id = pg_temp.id('u_pending');
select pg_temp.expect('signup_without_grant_creates_pending_request', 1, count(*)) from public.access_requests where user_id = pg_temp.id('u_pending') and status = 'pending';
select pg_temp.expect('signup_metadata_never_grants_staff_role', 0, count(*)) from public.user_profiles where id = pg_temp.id('u_pending') and user_type in ('yv_admin','yv_team');
select pg_temp.expect('admins_notified_of_access_request', 1, case when count(*) > 0 then 1 else 0 end) from public.notifications where kind = 'access_requested' and params->>'org' = 'RLS Pending';
select pg_temp.expect('confirmed_email_with_grant_is_provisioned', 1, count(*)) from public.user_profiles where id = pg_temp.id('u_granted') and user_type = 'yv_team';
select pg_temp.expect('grant_is_marked_used', 1, count(*)) from public.access_grants where email = 'rls-granted@example.com' and used_by = pg_temp.id('u_granted');
select pg_temp.expect('unconfirmed_email_with_grant_gets_nothing', 0, count(*)) from public.user_profiles where id = pg_temp.id('u_unconfirmed');

select pg_temp.as_user('rls-pending@example.com');
select pg_temp.expect('pending_user_has_no_session_membership', 0, count(*)) from public.whoami();
select pg_temp.expect('pending_user_reads_own_request', 1, count(*)) from public.access_requests;
select pg_temp.expect('pending_user_reads_no_grants', 0, count(*)) from public.access_grants;
select pg_temp.expect('pending_user_reads_no_portfolio', 0, count(*)) from public.portfolio_directory();
select pg_temp.expect('pending_user_reads_no_records', 0, count(*)) from public.startup_public_records;
select pg_temp.expect('pending_user_can_update_own_request', 1, count(*)) from public.submit_access_request('investor', 'RLS Fund', 'hello', 'RLS Pending');
select pg_temp.expect_error('pending_user_cannot_approve_self',
  format($q$select public.approve_access_request(%L, '00000000-0000-4000-8000-000000000001', 'yv_admin', true)$q$, pg_temp.id('u_pending')));
select pg_temp.expect_error('pending_user_cannot_edit_request_directly', $q$update public.access_requests set status = 'approved'$q$);
select pg_temp.expect_error('pending_user_cannot_grant_self',
  $q$insert into public.access_grants (email, org_id, user_type, granted_by) values ('rls-pending@example.com', '00000000-0000-4000-8000-000000000001', 'yv_admin', auth.uid())$q$);
reset role;

select pg_temp.as_user('investor.a@demo.test');
select pg_temp.expect('investor_cannot_read_access_requests', 0, count(*)) from public.access_requests;
select pg_temp.expect('investor_cannot_read_access_grants', 0, count(*)) from public.access_grants;
select pg_temp.expect_error('investor_cannot_approve_access',
  format($q$select public.approve_access_request(%L, %L, 'investor', false)$q$, pg_temp.id('u_pending'), pg_temp.id('org_inv_a')));
reset role;

select pg_temp.as_user('team@yv.demo');
select pg_temp.expect('team_cannot_read_access_requests', 0, count(*)) from public.access_requests;
select pg_temp.expect_error('team_cannot_approve_access',
  format($q$select public.approve_access_request(%L, %L, 'investor', false)$q$, pg_temp.id('u_pending'), pg_temp.id('org_inv_a')));
select pg_temp.expect_error('team_cannot_add_grant',
  format($q$insert into public.access_grants (email, org_id, user_type, granted_by) values ('x@example.com', %L, 'investor', auth.uid())$q$, pg_temp.id('org_inv_a')));
reset role;

select pg_temp.as_user('admin@yv.demo');
select pg_temp.expect('admin_reads_access_requests', 1, case when count(*) >= 1 then 1 else 0 end) from public.access_requests where user_id = pg_temp.id('u_pending');
select pg_temp.expect_error('grant_role_must_fit_org',
  $q$insert into public.access_grants (email, org_id, user_type, granted_by) values ('y@example.com', '00000000-0000-4000-8000-000000000001', 'investor', auth.uid())$q$);
select pg_temp.expect_error('approval_role_must_fit_org',
  format($q$select public.approve_access_request(%L, '00000000-0000-4000-8000-000000000001', 'founder', false)$q$, pg_temp.id('u_pending')));
select pg_temp.expect('admin_approves_request', 1, count(*)) from public.approve_access_request(pg_temp.id('u_pending'), pg_temp.id('org_inv_a'), 'investor', false) where approve_access_request;
reset role;

select pg_temp.as_user('rls-pending@example.com');
select pg_temp.expect('approved_user_gets_assigned_role', 1, count(*)) from public.whoami() where user_type = 'investor' and org_id = pg_temp.id('org_inv_a');
reset role;

-- Confirming the email later applies the waiting pre-approval.
update auth.users set email_confirmed_at = now() where id = pg_temp.id('u_unconfirmed');
select pg_temp.expect('grant_applies_when_email_confirmed', 1, count(*)) from public.user_profiles where id = pg_temp.id('u_unconfirmed') and user_type = 'investor';

-- ───────────── signed out ─────────────
set local role anon;
select pg_temp.expect_error('anon_cannot_list_portfolio', 'select * from public.portfolio_directory()');
select pg_temp.expect_error('anon_cannot_read_investors', 'select * from public.investors');
select pg_temp.expect_error('anon_cannot_read_public_records_table', 'select * from public.startup_public_records');
select pg_temp.expect_error('anon_cannot_read_funding_rounds', 'select * from public.funding_rounds');
select pg_temp.expect_error('anon_cannot_read_follows', 'select * from public.company_follows');
select pg_temp.expect_error('anon_cannot_read_access_requests', 'select * from public.access_requests');
select pg_temp.expect_error('anon_cannot_submit_access_request', $q$select public.submit_access_request('investor', 'x', 'x', 'x')$q$);
reset role;

-- ───────────── deactivated member ─────────────
update public.organization_members set is_active = false where user_id = (select id from auth.users where email = 'founder.b@demo.test');
select pg_temp.as_user('founder.b@demo.test');
select pg_temp.expect('deactivated_member_reads_no_startups', 0, count(*)) from public.startups;
select pg_temp.expect('deactivated_member_reads_no_records', 0, count(*)) from public.startup_public_records;
select pg_temp.expect('deactivated_member_gets_no_directory', 0, count(*)) from public.portfolio_directory();
select pg_temp.expect('deactivated_member_reads_no_rounds', 0, count(*)) from public.funding_rounds;
reset role;

select check_name, expected, actual, pass from rls_results order by pass, check_name;

rollback;
