-- Measures row-level-security cost. Run: supabase db query --linked --project-ref <ref> -f tests/perf/rls-bench.sql
-- Everything happens in one transaction that is rolled back: it adds 20,000 temporary public
-- records, times typical reads as an investor and as YV staff, and leaves no data behind.
begin;

create temp table bench (who text, query text, ms numeric, rows_returned bigint) on commit drop;
grant insert, select on bench to authenticated;

insert into public.startup_public_records (startup_id, title, url, publisher, kind, summary, published_on)
select s.id, 'Bench ' || g, 'https://bench.invalid/' || s.id || '/' || g, 'Bench', 'news', 'Bench row', date '2025-01-01' + (g % 600)
from (select id from public.startups where is_portfolio and deleted_at is null order by name limit 20) s, generate_series(1, 1000) g;
analyze public.startup_public_records;

-- Temporary investor and staff users (rolled back), so the benchmark needs no test accounts.
create or replace function pg_temp.bench_user(p_email text, p_type public.user_type, p_org uuid) returns void language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', p_email,
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into public.user_profiles (id, email, full_name, user_type) values (uid, p_email, p_email, p_type);
  insert into public.organization_members (org_id, user_id) values (p_org, uid);
end $$;
with org as (insert into public.organizations (type, name, is_demo) values ('investor', 'Bench investor', true) returning id)
select pg_temp.bench_user('bench.investor@example.com', 'investor', (select id from org));
select pg_temp.bench_user('bench.staff@example.com', 'yv_team', '00000000-0000-4000-8000-000000000001');

create or replace function pg_temp.measure(p_who text, p_name text, p_sql text) returns void language plpgsql as $$
declare plan json; total numeric := 0; n bigint;
begin
  for i in 1..5 loop
    execute 'explain (analyze, format json) ' || p_sql into plan;
    total := total + (plan -> 0 ->> 'Execution Time')::numeric;
  end loop;
  execute 'select count(*) from (' || p_sql || ') q' into n;
  insert into bench values (p_who, p_name, round(total / 5, 2), n);
end $$;

create or replace function pg_temp.run_as(p_email text, p_who text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform pg_temp.measure(p_who, 'count all public records', 'select count(*) from public.startup_public_records');
  perform pg_temp.measure(p_who, 'latest 50 public records', 'select * from public.startup_public_records order by published_on desc nulls last limit 50');
  perform pg_temp.measure(p_who, 'startups list', 'select id, name from public.startups');
  perform pg_temp.measure(p_who, 'investors list', 'select id from public.investors');
  perform pg_temp.measure(p_who, 'organizations list', 'select id from public.organizations');
end $$;

select pg_temp.run_as('bench.investor@example.com', 'investor');
select pg_temp.run_as('bench.staff@example.com', 'staff');
reset role;

select * from bench order by who, query;
rollback;
