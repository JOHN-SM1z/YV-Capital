-- One-time step for a NEW project, after seed.sql and seed-users.template.sql: removes the fictional
-- demo startups and investors, keeps two labelled sandbox investor organizations for testing, and
-- attaches the founder test logins to two real portfolio companies. It touches only rows that belong
-- to the demo records (fixed ids below).

delete from public.investment_opportunities where id::text like '00000000-0000-4000-8000-0000000000d_';
delete from public.meetings where title like '%(Demo)%';
delete from public.follow_ups f using public.investors i, public.organizations o
  where f.investor_id = i.id and o.id = i.org_id and o.is_demo;
delete from public.organizations where id in ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000a2','00000000-0000-4000-8000-0000000000a3');
delete from public.organizations where type = 'investor' and is_demo
  and id not in ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c2');

update public.organizations set name = 'Sandbox Investor A (test)' where id = '00000000-0000-4000-8000-0000000000c1';
update public.organizations set name = 'Sandbox Investor B (test)' where id = '00000000-0000-4000-8000-0000000000c2';
update public.investors set description = 'Sandbox organization for testing the investor portal. Not a real investor.', thesis = null
  where org_id in ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c2');
update public.investor_relationships set status = 'identified', priority = 'low', tags = '{sandbox}'
  where investor_id in (select id from public.investors where org_id in ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000c2'));

insert into public.organization_members (org_id, user_id, is_org_admin)
select s.org_id, u.id, true from public.startups s, auth.users u where s.name = 'Makon AI' and u.email = 'founder.a@demo.test'
on conflict (user_id) do update set org_id = excluded.org_id, is_active = true;
insert into public.organization_members (org_id, user_id, is_org_admin)
select s.org_id, u.id, true from public.startups s, auth.users u where s.name = 'TimePay' and u.email = 'founder.b@demo.test'
on conflict (user_id) do update set org_id = excluded.org_id, is_active = true;
update public.user_profiles set full_name = 'Test founder login (Makon AI)' where email = 'founder.a@demo.test';
update public.user_profiles set full_name = 'Test founder login (TimePay)' where email = 'founder.b@demo.test';
update public.user_profiles set full_name = 'Test investor login A' where email = 'investor.a@demo.test';
update public.user_profiles set full_name = 'Test investor login B' where email = 'investor.b@demo.test';
