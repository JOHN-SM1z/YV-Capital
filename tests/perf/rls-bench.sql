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

select pg_temp.run_as('investor.a@demo.test', 'investor');
select pg_temp.run_as('team@yv.demo', 'staff');
reset role;

select * from bench order by who, query;
rollback;
