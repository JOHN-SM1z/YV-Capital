-- One-time step for a NEW project, after seed.sql: removes every fictional demo record that seed.sql
-- creates for its workflow examples (startups, investors, opportunities, meetings, follow-ups).
-- It touches only rows that belong to the demo records (fixed ids or the is_demo flag).

delete from public.investment_opportunities where id::text like '00000000-0000-4000-8000-0000000000d_';
delete from public.meetings where title like '%(Demo)%';
delete from public.follow_ups f using public.investors i, public.organizations o
  where f.investor_id = i.id and o.id = i.org_id and o.is_demo;
delete from public.organizations where id in ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000a2','00000000-0000-4000-8000-0000000000a3');
delete from public.organizations where type = 'investor' and is_demo;
