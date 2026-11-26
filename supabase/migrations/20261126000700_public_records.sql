-- Real-data support: public records per portfolio company, internal next-round outlook,
-- YV check size, and sourced evidence on investor profiles.

alter table public.startups
  add column yv_check_usd numeric(14,2),
  add column yv_check_source text;

alter table public.investors
  add column evidence_type text check (evidence_type in ('investment','partnership','stated_interest')),
  add column evidence_summary text,
  add column evidence_url text,
  add column evidence_date date,
  add column uzbek_companies text[] not null default '{}';

create type public.round_likelihood as enum ('high','medium','low','insufficient_data');

-- Public, sourced information about a portfolio company (news, funding announcements, directories).
create table public.startup_public_records (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  title text not null,
  url text not null check (url ~ '^https://'),
  publisher text not null,
  published_on date,
  kind text not null check (kind in ('funding','news','directory','award','other')),
  summary text not null,
  amount_usd numeric(14,2),
  co_investors text[] not null default '{}',
  added_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  unique (startup_id, url)
);
create index on public.startup_public_records (startup_id, published_on desc nulls last);

-- Internal, signals-based estimate of when a company is likely to raise next. Staff only.
create table public.startup_round_outlook (
  startup_id uuid primary key references public.startups(id) on delete cascade,
  likelihood public.round_likelihood not null,
  expected_window text,
  rationale text not null,
  signals text[] not null default '{}',
  assessed_by uuid references public.user_profiles(id),
  assessed_at timestamptz not null default now()
);

alter table public.startup_public_records enable row level security;
alter table public.startup_round_outlook enable row level security;
revoke all on public.startup_public_records, public.startup_round_outlook from anon;

create or replace function private.is_portfolio_startup(p_startup uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.startups s where s.id = p_startup and s.is_portfolio and s.deleted_at is null)
$$;
grant execute on function private.is_portfolio_startup to authenticated;

-- Public records are public information: every active member may read those of portfolio companies.
create policy spr_read on public.startup_public_records for select to authenticated
  using (private.is_yv_staff()
    or (private.current_user_type() is not null and private.is_portfolio_startup(startup_id)));
create policy spr_write on public.startup_public_records for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

create policy sro_staff on public.startup_round_outlook for all to authenticated
  using (private.is_yv_staff()) with check (private.is_yv_staff());

-- Public portfolio directory for investors (no internal fields: stage, owner, notes, outlook).
create or replace function public.portfolio_directory()
returns table (id uuid, name text, sector text, one_liner text, logo_url text, website text, country text,
               founded_year int, team_size int, funding_stage text, record_count bigint, last_record_on date)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.sector, s.one_liner, s.logo_url, s.website, s.country, s.founded_year, s.team_size, s.funding_stage,
         count(r.id), max(r.published_on)
  from public.startups s
  left join public.startup_public_records r on r.startup_id = s.id
  where s.is_portfolio and s.deleted_at is null and private.current_user_type() is not null
  group by s.id
  order by s.name
$$;
revoke execute on function public.portfolio_directory from anon, public;
grant execute on function public.portfolio_directory to authenticated;
