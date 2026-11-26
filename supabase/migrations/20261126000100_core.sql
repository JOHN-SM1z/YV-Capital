-- YV Platform — core schema (lean v1)

-- ───────────── enums ─────────────
create type public.user_type as enum ('yv_admin','yv_team','investor','founder');
create type public.org_type as enum ('yv','investor','startup');
create type public.investor_category as enum ('vc_fund','family_office','cvc','fund_of_funds','dfi','institutional','angel_network','strategic','other');
create type public.relationship_status as enum ('identified','researched','qualified','contacted','meeting_scheduled','meeting_completed','interested','due_diligence','negotiation','partnership_signed','inactive','rejected');
create type public.priority_level as enum ('low','medium','high');
create type public.pipeline_stage as enum ('submitted','initial_screening','research','evaluation','founder_meeting','due_diligence','investment_readiness','internal_approval','approved_for_sharing','investor_outreach','active_investor_interest','co_investment_dd','negotiation','closed','rejected','on_hold');
create type public.verification_status as enum ('founder_submitted','yv_verified','public_source','rejected');
create type public.doc_status as enum ('submitted','under_review','info_required','verified','rejected');
create type public.classification as enum ('public','shared','confidential','highly_confidential');
create type public.opportunity_status as enum ('draft','internal_review','approved','shared','paused','closed','withdrawn');
create type public.interest_level as enum ('interested','info_requested','indicative','declined');
create type public.dd_status as enum ('open','with_startup','answered','released','closed');
create type public.request_status as enum ('open','answered','closed');
create type public.meeting_status as enum ('requested','scheduled','completed','cancelled');

-- ───────────── shared trigger ─────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────── identity ─────────────
create table public.roles (
  key public.user_type primary key,
  label text not null,
  description text not null
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.org_type not null,
  name text not null,
  website text,
  country text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  title text,
  user_type public.user_type not null references public.roles(key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  is_org_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id)               -- v1: one organization per user
);
create index on public.organization_members (org_id);

-- ───────────── investors ─────────────
create table public.investors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  category public.investor_category not null default 'vc_fund',
  headquarters text,
  description text,
  thesis text,
  portfolio_highlights text,
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.investor_preferences (
  investor_id uuid primary key references public.investors(id) on delete cascade,
  sectors text[] not null default '{}',
  stages text[] not null default '{}',
  geographies text[] not null default '{}',
  min_check numeric(14,2),
  max_check numeric(14,2),
  fund_size numeric(16,2),
  fund_size_verified boolean not null default false,
  central_asia_interest boolean not null default false,
  co_invest_appetite public.priority_level,
  updated_by uuid references public.user_profiles(id),
  updated_at timestamptz not null default now(),
  check (min_check is null or max_check is null or min_check <= max_check)
);

create table public.investor_contacts (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  full_name text not null,
  title text,
  email text,
  linkedin text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.investor_contacts (investor_id);

-- internal-only CRM layer (never visible to investors)
create table public.investor_relationships (
  investor_id uuid primary key references public.investors(id) on delete cascade,
  status public.relationship_status not null default 'identified',
  priority public.priority_level not null default 'medium',
  owner_id uuid references public.user_profiles(id),
  last_contact_at date,
  next_follow_up_at date,
  tags text[] not null default '{}',
  updated_by uuid references public.user_profiles(id),
  updated_at timestamptz not null default now()
);
create index on public.investor_relationships (status);

-- ───────────── startups ─────────────
create table public.startups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  name text not null,
  website text,
  logo_url text,
  headquarters text,
  country text not null default 'Uzbekistan',
  sector text,
  one_liner text,
  description text,
  problem text,
  solution text,
  target_market text,
  business_model text,
  team_size int,
  founded_year int,
  funding_stage text check (funding_stage in ('pre_seed','seed','series_a','series_b','growth')),
  -- YV-controlled fields (founders cannot change them; see trigger)
  stage public.pipeline_stage not null default 'submitted',
  is_portfolio boolean not null default false,
  owner_id uuid references public.user_profiles(id),
  source text,
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.startups (stage);

create table public.startup_founders (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  full_name text not null,
  role text,
  linkedin text,
  bio text,
  created_at timestamptz not null default now()
);
create index on public.startup_founders (startup_id);

-- every update is a new row (version history); latest per metric_key is current
create table public.startup_metrics (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  metric_key text not null,      -- revenue, arr, growth_rate, customers, active_users, ...
  value numeric(18,2) not null,
  unit text not null default 'USD',
  period text not null,          -- e.g. '2026-Q3', 'Oct 2026'
  source text not null,
  verification public.verification_status not null default 'founder_submitted',
  verified_by uuid references public.user_profiles(id),
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);
create index on public.startup_metrics (startup_id, metric_key, created_at desc);

create table public.startup_fundraising (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  round_type text not null check (round_type in ('pre_seed','seed','series_a','series_b','growth','bridge')),
  target_amount numeric(14,2),
  min_ticket numeric(14,2),
  max_ticket numeric(14,2),
  valuation_expectation numeric(16,2),
  use_of_funds text,
  current_investors text,
  previous_funding text,
  verification public.verification_status not null default 'founder_submitted',
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);
create index on public.startup_fundraising (startup_id, created_at desc);

create table public.startup_documents (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  doc_type text not null check (doc_type in ('pitch_deck','financial_statements','financial_model','cap_table','corporate_registration','shareholder_info','product_info','other')),
  title text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  status public.doc_status not null default 'submitted',
  classification public.classification not null default 'confidential',
  review_note text,                 -- shown to founder
  reviewed_by uuid references public.user_profiles(id),
  uploaded_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.startup_documents (startup_id);

create table public.startup_readiness_tasks (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  is_done boolean not null default false,
  due_date date,
  created_by uuid references public.user_profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.startup_readiness_tasks (startup_id);

create table public.startup_status_history (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  from_stage public.pipeline_stage,
  to_stage public.pipeline_stage not null,
  note text,
  changed_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

-- YV → founder requests (documents, questions, routed diligence questions)
create table public.startup_requests (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  dd_request_id uuid,               -- fk added below; never exposes the investor
  title text not null,
  body text,
  due_date date,
  status public.request_status not null default 'open',
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.startup_requests (startup_id);

create table public.startup_request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.startup_requests(id) on delete cascade,
  body text not null,
  document_id uuid references public.startup_documents(id) on delete set null,
  author_id uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

-- ───────────── opportunities ─────────────
create table public.investment_opportunities (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete restrict,
  title text not null,
  thesis text,
  sector text,
  stage text,
  target_amount numeric(14,2),
  min_ticket numeric(14,2),
  max_ticket numeric(14,2),
  valuation text,
  structure text,
  use_of_proceeds text,
  traction_highlights text,
  key_risks text,
  memo text,
  status public.opportunity_status not null default 'draft',
  owner_id uuid references public.user_profiles(id),
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  shared_at timestamptz,
  review_date date,
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.investment_opportunities (status);

create table public.opportunity_access (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.investment_opportunities(id) on delete cascade,
  investor_org_id uuid not null references public.organizations(id) on delete cascade,
  granted_by uuid references public.user_profiles(id),
  granted_at timestamptz not null default now(),
  unique (opportunity_id, investor_org_id)
);
create index on public.opportunity_access (investor_org_id);

create table public.opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.investment_opportunities(id) on delete cascade,
  document_id uuid not null references public.startup_documents(id) on delete cascade,
  added_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  unique (opportunity_id, document_id)
);

create table public.opportunity_status_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.investment_opportunities(id) on delete cascade,
  from_status public.opportunity_status,
  to_status public.opportunity_status not null,
  note text,
  changed_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

-- one row per (opportunity, investor org); non-binding by definition
create table public.investor_interests (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.investment_opportunities(id) on delete cascade,
  investor_org_id uuid not null references public.organizations(id) on delete cascade,
  level public.interest_level not null,
  indicative_amount numeric(14,2),
  note text,
  submitted_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, investor_org_id)
);

-- ───────────── diligence Q&A ─────────────
create table public.due_diligence_requests (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.investment_opportunities(id) on delete cascade,
  investor_org_id uuid not null references public.organizations(id) on delete cascade,
  question text not null,
  status public.dd_status not null default 'open',
  assigned_to uuid references public.user_profiles(id),
  asked_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.due_diligence_requests (investor_org_id);
create index on public.due_diligence_requests (opportunity_id);

alter table public.startup_requests
  add constraint startup_requests_dd_fk foreign key (dd_request_id)
  references public.due_diligence_requests(id) on delete set null;

-- answers drafted by YV; investors only see approved_for_release rows
create table public.due_diligence_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.due_diligence_requests(id) on delete cascade,
  body text not null,
  document_id uuid references public.startup_documents(id) on delete set null,
  approved_for_release boolean not null default false,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  author_id uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);
create index on public.due_diligence_responses (request_id);

-- ───────────── meetings & follow-ups ─────────────
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz,
  duration_min int not null default 30,
  location text,
  agenda text,
  status public.meeting_status not null default 'scheduled',
  investor_org_id uuid references public.organizations(id) on delete set null,
  startup_id uuid references public.startups(id) on delete set null,
  opportunity_id uuid references public.investment_opportunities(id) on delete set null,
  visible_to_investor boolean not null default false,
  visible_to_startup boolean not null default false,
  owner_id uuid references public.user_profiles(id),
  requested_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.meetings (starts_at);

create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete set null,
  name text not null,
  email text
);

-- internal-only meeting notes and outcome
create table public.meeting_notes (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  notes text,
  outcome text,
  updated_by uuid references public.user_profiles(id),
  updated_at timestamptz not null default now()
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date,
  priority public.priority_level not null default 'medium',
  is_done boolean not null default false,
  investor_id uuid references public.investors(id) on delete cascade,
  startup_id uuid references public.startups(id) on delete cascade,
  opportunity_id uuid references public.investment_opportunities(id) on delete cascade,
  assigned_to uuid references public.user_profiles(id),
  created_by uuid references public.user_profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.follow_ups (assigned_to, is_done, due_date);

-- internal-only notes on any record (assessments, call notes)
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('investor','startup','opportunity')),
  entity_id uuid not null,
  body text not null,
  is_assessment boolean not null default false,
  created_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);
create index on public.notes (entity_type, entity_id);

-- ───────────── governance ─────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, read_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);

create table public.document_access_logs (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.startup_documents(id) on delete cascade,
  user_id uuid,
  created_at timestamptz not null default now()
);

create table public.program_kpi_targets (
  key text primary key,
  label text not null,
  target numeric not null,
  target_max numeric,
  sort_order int not null default 0,
  owner_id uuid references public.user_profiles(id),
  data_source text not null,
  updated_at timestamptz not null default now()
);

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['organizations','user_profiles','investors','investor_preferences','investor_relationships','startups','startup_documents','startup_requests','investment_opportunities','investor_interests','due_diligence_requests','meetings','meeting_notes','program_kpi_targets']
  loop execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t); end loop;
end $$;

insert into public.roles (key, label, description) values
  ('yv_admin','YV Admin','Program leadership. Full access, approves sharing, manages users.'),
  ('yv_team','YV Team','Investment, investor relations and analysts. Manages records; cannot approve sharing.'),
  ('investor','Investor','Member of an investor organization. Sees only what YV shares with their organization.'),
  ('founder','Founder','Member of a startup. Sees only their own company.');
