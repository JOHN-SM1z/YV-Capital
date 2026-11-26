-- Crunchbase-style structure applied to YV's own sourced data (see docs/crunchbase-analysis-2026-11-26.md):
--   companies ↔ funding rounds ↔ round participants, plus "follow a company" with alerts.
-- Nothing here is copied from Crunchbase. Every round must cite one of the company's public records.

-- ───────────── funding rounds ─────────────
create table public.funding_rounds (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  -- Only set when the source names the round type; most local announcements don't.
  round_type text check (round_type in ('pre_seed','seed','series_a','series_b','growth','bridge')),
  -- Date the source reported the round (not necessarily the close date). Null when the source gives none.
  announced_on date,
  amount_usd numeric(14,2) check (amount_usd > 0),
  -- Provenance is mandatory: a round without a public source is not shown anywhere.
  source_record_id uuid not null references public.startup_public_records(id) on delete cascade,
  note text check (char_length(note) <= 300),
  -- Stable key for rounds loaded from supabase/data (null for rounds added in the app).
  data_key text,
  added_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (startup_id, data_key)
);
create index funding_rounds_startup_idx on public.funding_rounds (startup_id, announced_on desc nulls last);
create index funding_rounds_source_idx on public.funding_rounds (source_record_id);
create index funding_rounds_added_by_idx on public.funding_rounds (added_by);

-- Who took part, as named by the source. Plain names: most co-investors are not platform organizations,
-- and linking would expose platform IDs of other investor organizations.
create table public.round_participants (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.funding_rounds(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  amount_usd numeric(14,2) check (amount_usd > 0),
  -- Only true when the source says the participant led the round.
  is_lead boolean not null default false,
  unique (round_id, name)
);

alter table public.funding_rounds enable row level security;
alter table public.round_participants enable row level security;
revoke all on public.funding_rounds, public.round_participants from anon;

-- Same visibility as public records: portfolio companies to every active member, the rest to staff.
create policy fr_read on public.funding_rounds for select to authenticated
  using ((select private.is_yv_staff())
    or (((select private.current_user_type()) is not null) and (startup_id in (select private.portfolio_startup_ids()))));
create policy fr_insert on public.funding_rounds for insert to authenticated with check ((select private.is_yv_staff()));
create policy fr_update on public.funding_rounds for update to authenticated
  using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
create policy fr_delete on public.funding_rounds for delete to authenticated using ((select private.is_yv_staff()));

-- A participant is visible exactly when its round is (the subquery runs under the caller's RLS).
create policy rp_read on public.round_participants for select to authenticated
  using (round_id in (select r.id from public.funding_rounds r));
create policy rp_insert on public.round_participants for insert to authenticated with check ((select private.is_yv_staff()));
create policy rp_update on public.round_participants for update to authenticated
  using ((select private.is_yv_staff())) with check ((select private.is_yv_staff()));
create policy rp_delete on public.round_participants for delete to authenticated using ((select private.is_yv_staff()));

-- The cited record must belong to the same company.
create or replace function private.guard_round_source() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.startup_public_records r where r.id = new.source_record_id and r.startup_id = new.startup_id) then
    raise exception 'The source record must belong to the same company' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger funding_rounds_source before insert or update of source_record_id, startup_id on public.funding_rounds
  for each row execute function private.guard_round_source();

-- ───────────── follows (watchlist) ─────────────
create table public.company_follows (
  user_id uuid not null default auth.uid() references public.user_profiles(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, startup_id)
);
create index company_follows_startup_idx on public.company_follows (startup_id);

alter table public.company_follows enable row level security;
revoke all on public.company_follows from anon;

-- Your own follows. Staff also see who follows what (an internal interest signal, never shown to
-- investors or founders); the investor UI says so.
create policy cf_read on public.company_follows for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_yv_staff()));
create policy cf_insert on public.company_follows for insert to authenticated
  with check (user_id = (select auth.uid())
    and ((select private.is_yv_staff())
      or ((select private.current_user_type()) = 'investor' and startup_id in (select private.portfolio_startup_ids()))));
create policy cf_delete on public.company_follows for delete to authenticated using (user_id = (select auth.uid()));

-- Alerts: followers hear about new public records and funding rounds of the companies they follow.
-- Investors only while the company is in the portfolio; the person who added the item is not notified.
create or replace function private.notify_followers() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_company text; v_kind text; v_title text;
begin
  select s.name into v_company from public.startups s where s.id = new.startup_id;
  if tg_table_name = 'funding_rounds' then
    v_kind := 'followed_round';
    v_title := coalesce('$' || to_char(new.amount_usd, 'FM999,999,999,990'), '');
  else
    v_kind := 'followed_record';
    v_title := new.title;
  end if;
  insert into public.notifications (user_id, title, body, link, kind, params)
  select f.user_id, v_kind, v_title,
         case when p.user_type = 'investor' then '/investor/portfolio/' || new.startup_id else '/admin/startups/' || new.startup_id end,
         v_kind, jsonb_build_object('company', v_company, 'title', v_title)
  from public.company_follows f
  join public.user_profiles p on p.id = f.user_id
  join public.organization_members m on m.user_id = f.user_id and m.is_active
  where f.startup_id = new.startup_id
    and f.user_id is distinct from auth.uid()
    and (p.user_type in ('yv_admin','yv_team')
      or (p.user_type = 'investor' and exists (select 1 from public.startups s where s.id = new.startup_id and s.is_portfolio and s.deleted_at is null)));
  return new;
end $$;
revoke execute on function private.notify_followers from anon, public, authenticated;
create trigger startup_public_records_notify after insert on public.startup_public_records
  for each row execute function private.notify_followers();
create trigger funding_rounds_notify after insert on public.funding_rounds
  for each row execute function private.notify_followers();

-- ───────────── portfolio directory: Crunchbase-style funding summary fields ─────────────
drop function public.portfolio_directory();
create function public.portfolio_directory()
returns table (id uuid, name text, sector text, one_liner text, logo_url text, website text, country text,
               founded_year int, team_size int, funding_stage text, record_count bigint, last_record_on date,
               round_count bigint, disclosed_usd numeric, last_round_on date, last_round_type text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.sector, s.one_liner, s.logo_url, s.website, s.country, s.founded_year, s.team_size, s.funding_stage,
         (select count(*) from public.startup_public_records r where r.startup_id = s.id),
         (select max(r.published_on) from public.startup_public_records r where r.startup_id = s.id),
         (select count(*) from public.funding_rounds f where f.startup_id = s.id),
         (select sum(f.amount_usd) from public.funding_rounds f where f.startup_id = s.id),
         (select max(f.announced_on) from public.funding_rounds f where f.startup_id = s.id),
         (select f.round_type from public.funding_rounds f where f.startup_id = s.id
            order by f.announced_on desc nulls last, f.created_at desc limit 1)
  from public.startups s
  where s.is_portfolio and s.deleted_at is null and private.current_user_type() is not null
  order by s.name
$$;
revoke execute on function public.portfolio_directory from anon, public;
grant execute on function public.portfolio_directory to authenticated;
