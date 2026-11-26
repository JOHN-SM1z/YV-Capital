-- YV Platform seed data.
--  • Real portfolio: 38 companies listed publicly on yoshlarventures.uz (name, sector, one-liner only).
--    The unlabeled dollar figures on the public site are intentionally NOT imported.
--  • Everything marked is_demo / "DEMO" is FICTIONAL and exists only to demonstrate the workflow.
--  • Demo login users are created separately (see supabase/seed-users.template.sql); no passwords here.

-- YV organization
insert into public.organizations (id, type, name, website, country)
values ('00000000-0000-4000-8000-000000000001', 'yv', 'Yoshlar Ventures', 'https://yoshlarventures.uz', 'Uzbekistan')
on conflict (id) do nothing;

-- ───────────── real portfolio (public source) ─────────────
with src(name, sector, one_liner) as (values
  ('IjaraSoft','PropTech','Automation platform for the rental sector, B2B and B2C'),
  ('Moomkin','MarTech','Location-based discounts and promotions'),
  ('Adride','AdTech','Geotargeted advertising on taxi screens'),
  ('Diip.uz','Logistics','Cargo and transport matching'),
  ('Lumi','EdTech','Find and book children''s clubs'),
  ('Between','MarTech','Connects businesses with micro-influencers'),
  ('Business Robots AI','AI / SaaS','AI agent for sales and customer communication'),
  ('Tingla AI','EdTech','AI audio and text book reading'),
  ('Mebelim','E-commerce','Unified CRM/ERP for furniture businesses'),
  ('The CarGo','Logistics','Management platform for car-transport brokers'),
  ('ContentCoach','MarTech','AI-personalized content strategy'),
  ('Fonus Kids','EdTech','Safe educational video for children'),
  ('Makon AI','EdTech','AI preparation for SAT and ACT'),
  ('Nav AI','AI / SaaS','AI that automates phone-based customer contact'),
  ('SecurePrompt','Cybersecurity','Securing AI prompts for banks'),
  ('Onless','EdTech','AI preparation for the driving-licence exam'),
  ('Camvi','Computer Vision','Vision analytics for retail'),
  ('Body Tester','HealthTech','AI device for quick health diagnostics'),
  ('Prestige Club','TravelTech','White-label travel platform for banks'),
  ('DriveX','Mobility','Modular off-road transport for mountain areas'),
  ('Drone EduTrain','EdTech','Drone lab ecosystem for schools'),
  ('Educoin','EdTech','Digitizing learning motivation'),
  ('Hisobchi-AI','FinTech','AI financial bookkeeper'),
  ('Inter-AI','HR Tech','AI interviews and candidate screening'),
  ('Tilmoch-AI','AI / SaaS','AI editor for the Uzbek language'),
  ('Bozorly','FoodTech','Personal AI meal-planning assistant'),
  ('Zehnly AI','EdTech','Game-based AI foreign-language app'),
  ('FieldyIO','AI / SaaS','Operations system for field-service companies'),
  ('Microgreen','AgriTech','Hydroponic microgreen and strawberry farm in Samarkand'),
  ('Bonu','FoodTech','Custom cake constructor'),
  ('UrbanDrive','Mobility','Online marketplace for new cars'),
  ('TimePay','HR Tech','HRM for SMBs in Central Asia: Face ID attendance, payroll, KPIs'),
  ('Core AI','AI / SaaS','Local GPU and AI infrastructure and model services'),
  ('Mimoram AI','PropTech','AI 3D interior design linked to buyable products'),
  ('Jilo AI','Media','AI video-editing automation'),
  ('Binova','E-commerce','B2B construction-materials marketplace'),
  ('Hamroh IO','IoT','Desktop app plus compact display for productivity'),
  ('SpaceAgro','AgriTech','Soil tests turned into fertilizer recommendations')
), orgs as (
  insert into public.organizations (type, name, country)
  select 'startup', name, 'Uzbekistan' from src
  returning id, name
)
insert into public.startups (org_id, name, sector, one_liner, is_portfolio, stage, source)
select o.id, s.name, s.sector, s.one_liner, true, 'submitted', 'yoshlarventures.uz (public)'
from orgs o join src s on s.name = o.name;

-- ───────────── DEMO startups (fictional) ─────────────
insert into public.organizations (id, type, name, country, is_demo) values
  ('00000000-0000-4000-8000-0000000000a1','startup','Karvon Freight (Demo)','Uzbekistan', true),
  ('00000000-0000-4000-8000-0000000000a2','startup','Shifo Health (Demo)','Uzbekistan', true),
  ('00000000-0000-4000-8000-0000000000a3','startup','Daromad Pay (Demo)','Uzbekistan', true);

insert into public.startups (id, org_id, name, website, headquarters, sector, one_liner, description, problem, solution,
  target_market, business_model, team_size, founded_year, funding_stage, stage, is_portfolio, source) values
  ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000a1','Karvon Freight (Demo)', null, 'Tashkent',
   'Logistics','Digital freight forwarding for Central Asia–Europe trade lanes',
   'Fictional demo company. Karvon matches shippers with vetted carriers on cross-border lanes and handles customs paperwork.',
   'Cross-border trucking is booked by phone with no price transparency.', 'Instant quotes, vetted carriers and digital customs filing.',
   'SME exporters in Uzbekistan and Kazakhstan', 'Take rate on each shipment', 14, 2023, 'seed', 'active_investor_interest', false, 'DEMO (fictional)'),
  ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000a2','Shifo Health (Demo)', null, 'Samarkand',
   'HealthTech','Telemedicine and e-prescriptions for regional clinics',
   'Fictional demo company. Shifo connects regional clinics with specialists in Tashkent.',
   'Regional patients travel hours to see specialists.', 'Video consultations and e-prescriptions integrated with clinic workflows.',
   'Private clinics outside Tashkent', 'SaaS subscription per clinic', 8, 2024, 'pre_seed', 'investor_outreach', false, 'DEMO (fictional)'),
  ('00000000-0000-4000-8000-0000000000b3','00000000-0000-4000-8000-0000000000a3','Daromad Pay (Demo)', null, 'Tashkent',
   'FinTech','Payroll and earned-wage access for SMEs',
   'Fictional demo company. Daromad automates payroll and lets employees draw earned wages early.',
   'SME payroll is manual and employees rely on informal loans.', 'Automated payroll with earned-wage access.',
   'SMEs with 20–500 employees', 'Per-employee monthly fee', 11, 2023, 'seed', 'internal_approval', false, 'DEMO (fictional)');

insert into public.startup_founders (startup_id, full_name, role) values
  ('00000000-0000-4000-8000-0000000000b1','Demo Founder A','CEO'),
  ('00000000-0000-4000-8000-0000000000b1','Demo Co-founder','CTO'),
  ('00000000-0000-4000-8000-0000000000b2','Demo Founder B','CEO'),
  ('00000000-0000-4000-8000-0000000000b3','Demo Founder C','CEO');

insert into public.startup_metrics (startup_id, metric_key, value, unit, period, source, verification) values
  ('00000000-0000-4000-8000-0000000000b1','revenue', 38000, 'USD', '2026-Q3', 'Founder-reported (demo)', 'founder_submitted'),
  ('00000000-0000-4000-8000-0000000000b1','growth_rate', 22, '% MoM', '2026-Q3', 'Founder-reported (demo)', 'founder_submitted'),
  ('00000000-0000-4000-8000-0000000000b1','customers', 64, 'count', 'Oct 2026', 'Bank statements reviewed by YV (demo)', 'yv_verified'),
  ('00000000-0000-4000-8000-0000000000b2','active_users', 1200, 'count', 'Oct 2026', 'Founder-reported (demo)', 'founder_submitted'),
  ('00000000-0000-4000-8000-0000000000b2','customers', 9, 'clinics', 'Oct 2026', 'Signed contracts reviewed by YV (demo)', 'yv_verified'),
  ('00000000-0000-4000-8000-0000000000b3','revenue', 21000, 'USD', '2026-Q3', 'Founder-reported (demo)', 'founder_submitted');

insert into public.startup_fundraising (startup_id, round_type, target_amount, min_ticket, max_ticket, use_of_funds, previous_funding, verification) values
  ('00000000-0000-4000-8000-0000000000b1','seed', 400000, 50000, 200000, 'Kazakhstan expansion, carrier onboarding, product team', 'Angel round (demo)', 'yv_verified'),
  ('00000000-0000-4000-8000-0000000000b2','pre_seed', 250000, 25000, 100000, 'Clinic sales team and regulatory approvals', 'Grant (demo)', 'founder_submitted'),
  ('00000000-0000-4000-8000-0000000000b3','seed', 750000, 100000, 300000, 'Lending partner integrations and compliance', 'None (demo)', 'founder_submitted');

-- default readiness checklist for every startup with founders on the platform (demo ones)
insert into public.startup_readiness_tasks (startup_id, title, sort_order, is_done)
select s.id, t.title, t.ord, (s.id = '00000000-0000-4000-8000-0000000000b1' and t.ord <= 6)
from public.startups s
cross join (values
  (1,'Company profile completed'),(2,'Pitch deck uploaded'),(3,'Financial model submitted'),
  (4,'Revenue and traction metrics documented'),(5,'Cap table submitted'),(6,'Corporate documents submitted'),
  (7,'Market analysis completed'),(8,'Fundraising requirements documented'),(9,'Management team information completed')
) as t(ord, title)
where s.source = 'DEMO (fictional)';

-- ───────────── DEMO investors (fictional) ─────────────
with src(org_id, name, website, country, category, hq, thesis, sectors, stages, geos, min_c, max_c, ca, coinv, status, prio) as (values
  ('00000000-0000-4000-8000-0000000000c1'::uuid,'Meridian Frontier Partners (Demo)',null,'United Arab Emirates','vc_fund','Dubai',
   'Early-stage software and logistics in frontier markets between Europe and Asia.',
   array['AI / SaaS','FinTech','Logistics'], array['seed','series_a'], array['Central Asia','MENA'], 150000, 1000000, true, 'high','interested','high'),
  ('00000000-0000-4000-8000-0000000000c2'::uuid,'Altyn Bridge Family Office (Demo)',null,'Kazakhstan','family_office','Almaty',
   'Regional champions in agriculture, health and logistics across Central Asia.',
   array['AgriTech','HealthTech','Logistics'], array['pre_seed','seed'], array['Central Asia'], 100000, 500000, true, 'medium','meeting_completed','high'),
  ('00000000-0000-4000-8000-0000000000c3'::uuid,'Tessera Growth Capital (Demo)',null,'Singapore','vc_fund','Singapore',
   'Series A fintech and commerce platforms in emerging Asia.',
   array['FinTech','E-commerce','AI / SaaS'], array['series_a'], array['Southeast Asia','Emerging Markets'], 500000, 3000000, false, 'medium','contacted','medium'),
  ('00000000-0000-4000-8000-0000000000c4'::uuid,'Lumen Industrial Ventures (Demo)',null,'Germany','cvc','Munich',
   'Corporate venture arm investing in industrial IoT, vision and mobility.',
   array['IoT','Computer Vision','Mobility'], array['seed','series_a'], array['Europe','Emerging Markets'], 250000, 1500000, true, 'medium','qualified','medium'),
  ('00000000-0000-4000-8000-0000000000c5'::uuid,'Kestrel Fund of Funds (Demo)',null,'United Kingdom','fund_of_funds','London',
   'Backs emerging-market venture managers and co-invests alongside them.',
   array[]::text[], array['series_a','growth'], array['Emerging Markets'], 2000000, 10000000, true, 'high','researched','medium'),
  ('00000000-0000-4000-8000-0000000000c6'::uuid,'Silkway Development Finance (Demo)',null,'Netherlands','dfi','Amsterdam',
   'Development finance for inclusive fintech, agriculture and education.',
   array['FinTech','AgriTech','EdTech'], array['seed','series_a'], array['Central Asia','Caucasus'], 500000, 5000000, true, 'high','due_diligence','high'),
  ('00000000-0000-4000-8000-0000000000c7'::uuid,'Harbor Point Angels (Demo)',null,'United States','angel_network','Boston',
   'Angel network with a diaspora founders track.',
   array['AI / SaaS','EdTech','HealthTech'], array['pre_seed','seed'], array['Global'], 25000, 150000, true, 'medium','meeting_scheduled','medium'),
  ('00000000-0000-4000-8000-0000000000c8'::uuid,'Bosphorus Strategic Holdings (Demo)',null,'Turkey','strategic','Istanbul',
   'Strategic investor in commerce, logistics and food supply chains.',
   array['E-commerce','Logistics','FoodTech'], array['seed','series_a'], array['Turkey','Central Asia'], 300000, 2000000, true, 'medium','interested','medium'),
  ('00000000-0000-4000-8000-0000000000c9'::uuid,'Nordlys Impact Ventures (Demo)',null,'Norway','vc_fund','Oslo',
   'Impact-first pre-seed and seed in education, health and food systems.',
   array['EdTech','HealthTech','AgriTech'], array['pre_seed','seed'], array['Global','Emerging Markets'], 50000, 400000, false, 'low','identified','low'),
  ('00000000-0000-4000-8000-0000000000ca'::uuid,'Sakura Horizon CVC (Demo)',null,'Japan','cvc','Tokyo',
   'Corporate venture capital for AI, vision and security.',
   array['AI / SaaS','Computer Vision','Cybersecurity'], array['series_a'], array['Asia'], 1000000, 5000000, false, 'low','inactive','low')
), o as (
  insert into public.organizations (id, type, name, website, country, is_demo)
  select org_id, 'investor', name, website, country, true from src returning id
), i as (
  insert into public.investors (org_id, category, headquarters, thesis, description)
  select s.org_id, s.category::public.investor_category, s.hq, s.thesis, 'Fictional demo investor for workflow demonstration.'
  from src s join o on o.id = s.org_id
  returning id, org_id
), p as (
  insert into public.investor_preferences (investor_id, sectors, stages, geographies, min_check, max_check, central_asia_interest, co_invest_appetite)
  select i.id, s.sectors, s.stages, s.geos, s.min_c, s.max_c, s.ca, s.coinv::public.priority_level
  from i join src s on s.org_id = i.org_id returning investor_id
)
insert into public.investor_relationships (investor_id, status, priority, last_contact_at, next_follow_up_at)
select i.id, s.status::public.relationship_status, s.prio::public.priority_level,
       current_date - (random() * 30)::int, current_date + (random() * 14)::int - 3
from i join src s on s.org_id = i.org_id;

insert into public.investor_contacts (investor_id, full_name, title, email, is_primary)
select i.id, 'Demo Partner', 'Partner', 'partner@' || lower(replace(split_part(o.name, ' ', 1), ' ', '')) || '.demo.test', true
from public.investors i join public.organizations o on o.id = i.org_id where o.is_demo;

-- ───────────── DEMO opportunities ─────────────
insert into public.investment_opportunities (id, startup_id, title, thesis, sector, stage, target_amount, min_ticket, max_ticket,
  structure, use_of_proceeds, traction_highlights, key_risks, memo, status, approved_at, shared_at) values
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000b1','Karvon Freight — Seed (Demo)',
   'Digitizing cross-border freight on the Central Asia–Europe corridor.','Logistics','seed', 400000, 50000, 200000,
   'SAFE, post-money cap to be agreed','Kazakhstan expansion, carrier onboarding, product team',
   '64 shipper customers (YV-verified); 22% MoM revenue growth (founder-reported)',
   'Carrier supply concentration; FX exposure; customs regulation changes',
   'Fictional demo memorandum. Executive summary, market, traction and team sections would appear here in the investor-facing version.',
   'shared', now() - interval '10 days', now() - interval '9 days'),
  ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000b2','Shifo Health — Pre-seed (Demo)',
   'Specialist care for regional Uzbekistan through clinic-integrated telemedicine.','HealthTech','pre_seed', 250000, 25000, 100000,
   'SAFE','Clinic sales team and regulatory approvals','9 paying clinics (YV-verified)',
   'Regulatory approval timelines; clinic adoption speed',
   'Fictional demo memorandum.', 'shared', now() - interval '5 days', now() - interval '4 days'),
  ('00000000-0000-4000-8000-0000000000d3','00000000-0000-4000-8000-0000000000b3','Daromad Pay — Seed (Demo)',
   'Payroll plus earned-wage access for Central Asian SMEs.','FinTech','seed', 750000, 100000, 300000,
   'Priced equity','Lending partner integrations and compliance','USD 21K quarterly revenue (founder-reported)',
   'Credit risk via lending partner; licensing', 'Fictional demo memorandum.', 'internal_review', null, null);

-- access must be granted after approval (trigger enforces this)
insert into public.opportunity_access (opportunity_id, investor_org_id) values
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c1'),
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c8'),
  ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000c2');

insert into public.investor_interests (opportunity_id, investor_org_id, level, indicative_amount, note) values
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c1','interested', 150000, 'Non-binding. Would like to review unit economics.'),
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c8','info_requested', null, null);

insert into public.due_diligence_requests (id, opportunity_id, investor_org_id, question, status) values
  ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c1',
   'What is the contribution margin per shipment on the Tashkent–Almaty lane?', 'with_startup'),
  ('00000000-0000-4000-8000-0000000000e2','00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c8',
   'Which carriers account for more than 20% of capacity?', 'answered');

insert into public.startup_requests (startup_id, dd_request_id, title, body, status, due_date) values
  ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000e1','Contribution margin by lane',
   'Please share contribution margin per shipment for the Tashkent–Almaty lane for the last two quarters.', 'open', current_date + 5),
  ('00000000-0000-4000-8000-0000000000b1', null,'Upload latest cap table','Please upload a fully diluted cap table.', 'open', current_date + 7);

-- one answered-but-NOT-released response (must stay invisible to the investor)
insert into public.due_diligence_responses (request_id, body, approved_for_release) values
  ('00000000-0000-4000-8000-0000000000e2','Two carriers each provide ~25% of capacity; diversification plan in progress. (demo, pending YV approval)', false);

-- ───────────── meetings & follow-ups ─────────────
insert into public.meetings (title, starts_at, duration_min, location, agenda, status, investor_org_id, startup_id, opportunity_id, visible_to_investor, visible_to_startup) values
  ('Intro call — Altyn Bridge (Demo)', now() - interval '20 days', 45, 'Video call', 'YV portfolio overview', 'completed', '00000000-0000-4000-8000-0000000000c2', null, null, true, false),
  ('Silkway DFI partnership discussion (Demo)', now() - interval '12 days', 60, 'Tashkent office', 'Co-investment framework', 'completed', '00000000-0000-4000-8000-0000000000c6', null, null, true, false),
  ('Meridian × Karvon founder meeting (Demo)', now() + interval '3 days', 45, 'Video call', 'Founder presentation and Q&A',
   'scheduled', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000d1', true, true),
  ('Harbor Point Angels intro (Demo)', now() + interval '6 days', 30, 'Video call', 'Diaspora founders track', 'scheduled', '00000000-0000-4000-8000-0000000000c7', null, null, true, false);

insert into public.meeting_notes (meeting_id, notes, outcome)
select id, 'Internal notes (demo): strong interest in agri and health deal flow.', 'Follow up with two portfolio companies'
from public.meetings where title like 'Intro call — Altyn%';

insert into public.follow_ups (title, due_date, priority, investor_id)
select 'Send Q4 portfolio update to ' || o.name, current_date + 2, 'high', i.id
from public.investors i join public.organizations o on o.id = i.org_id
where o.id in ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000c6');
insert into public.follow_ups (title, due_date, priority, investor_id)
select 'Share co-investment term sheet draft', current_date - 1, 'high', i.id
from public.investors i where i.org_id = '00000000-0000-4000-8000-0000000000c6';

-- ───────────── 180-day KPI targets (editable by admins) ─────────────
insert into public.program_kpi_targets (key, label, target, target_max, sort_order, data_source) values
  ('qualified_investors','Qualified international capital providers mapped', 50, null, 1, 'Investor relationships past "Researched"'),
  ('priority_relationships','Priority investor relationships', 20, null, 2, 'Investor relationships with High priority'),
  ('substantive_meetings','Substantive investor meetings', 12, null, 3, 'Completed meetings linked to an investor'),
  ('investment_ready_startups','Investment-ready startups', 3, 5, 4, 'Startups at "Investment readiness" stage or later'),
  ('diligence_processes','Formal co-investment diligence processes', 2, null, 5, 'Startups in co-investment diligence, negotiation or closed'),
  ('signed_partnerships','Signed strategic or co-investment partnerships', 1, null, 6, 'Investor relationships marked "Partnership signed"')
on conflict (key) do nothing;
