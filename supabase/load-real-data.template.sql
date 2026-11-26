-- Loads supabase/data/*.json into the database. `pnpm data:sql` writes supabase/generated/real-data.sql.
-- Safe to re-run: it never deletes user-created rows and never overwrites values people have edited
-- (company profile fields, investor preferences, relationship status, staff-written outlooks).
-- Run after seed.sql and remove-demo-data.sql on a new project.

create or replace function pg_temp.text_array(j jsonb) returns text[] language sql immutable as $$
  select coalesce(array(select jsonb_array_elements_text(coalesce(j, '[]'::jsonb))), '{}')
$$;

create or replace function pg_temp.load_portfolio(j jsonb) returns int language plpgsql as $$
declare
  c jsonb; r jsonb; f jsonb; m jsonb; rd jsonb; sid uuid; rec_id uuid; rid uuid; n int := 0;
  logos jsonb := j->'logos';
  defaults text[] := array['Company profile completed','Pitch deck uploaded','Financial model submitted',
    'Revenue and traction metrics documented','Cap table submitted','Corporate documents submitted',
    'Market analysis completed','Fundraising requirements documented','Management team information completed'];
begin
  for c in select * from jsonb_array_elements(j->'companies') loop
    select id into sid from public.startups where name = c->>'name' and is_portfolio;
    if sid is null then raise exception 'Portfolio company % not found', c->>'name'; end if;

    update public.startups set
      sector = coalesce(sector, c->>'sector'), one_liner = coalesce(one_liner, c->>'one_liner'),
      funding_stage = coalesce(funding_stage, c->>'stage'),
      logo_url = logos->>(c->>'name'),
      yv_check_usd = (c->>'yv_check_usd')::numeric,
      yv_check_source = 'Figure printed on the yoshlarventures.uz portfolio card, unlabelled there (retrieved ' || (j->>'retrieved') || ')',
      source = 'yoshlarventures.uz (public)'
    where id = sid;

    insert into public.startup_public_records (startup_id, title, url, publisher, published_on, kind, summary, amount_usd)
    -- No published date: the listing is a standing page, and a retrieval date would look like fresh news.
    values (sid, 'Yoshlar Ventures portfolio listing', 'https://yoshlarventures.uz', 'Yoshlar Ventures', null, 'directory',
            (c->>'one_liner') || '. Listed in the YV portfolio; the card shows the figure $' || to_char((c->>'yv_check_usd')::numeric, 'FM999,999,990') || '.',
            (c->>'yv_check_usd')::numeric)
    on conflict (startup_id, url) do update set summary = excluded.summary, amount_usd = excluded.amount_usd, published_on = null;

    -- Drop previously loaded records that are no longer in the source file (records added in the app are kept).
    delete from public.startup_public_records p where p.startup_id = sid and p.added_by is null
      and p.url <> 'https://yoshlarventures.uz'
      and not exists (select 1 from jsonb_array_elements(c->'records') x where x->>'url' = p.url);

    for r in select * from jsonb_array_elements(c->'records') loop
      insert into public.startup_public_records (startup_id, title, url, publisher, published_on, kind, summary, amount_usd, co_investors)
      values (sid, r->>'title', r->>'url', r->>'publisher', (r->>'date')::date, r->>'kind', r->>'summary', (r->>'amount_usd')::numeric, pg_temp.text_array(r->'co_investors'))
      on conflict (startup_id, url) do update set title = excluded.title, summary = excluded.summary, amount_usd = excluded.amount_usd,
        published_on = excluded.published_on, kind = excluded.kind, co_investors = excluded.co_investors;
    end loop;

    -- Funding rounds structured from the records above (rounds added in the app have no data_key and are kept).
    delete from public.funding_rounds fr where fr.startup_id = sid and fr.data_key is not null
      and not exists (select 1 from jsonb_array_elements(coalesce(c->'rounds', '[]')) x where x->>'key' = fr.data_key);
    for rd in select * from jsonb_array_elements(coalesce(c->'rounds', '[]')) loop
      select id into rec_id from public.startup_public_records where startup_id = sid and url = rd->>'source_url';
      if rec_id is null then raise exception 'Round % of % cites a record that is not loaded', rd->>'key', c->>'name'; end if;
      insert into public.funding_rounds (startup_id, round_type, announced_on, amount_usd, source_record_id, note, data_key)
      values (sid, rd->>'type', (rd->>'date')::date, (rd->>'amount_usd')::numeric, rec_id, rd->>'note', rd->>'key')
      on conflict (startup_id, data_key) do update set round_type = excluded.round_type, announced_on = excluded.announced_on,
        amount_usd = excluded.amount_usd, source_record_id = excluded.source_record_id, note = excluded.note
      returning id into rid;
      delete from public.round_participants where round_participants.round_id = rid;
      insert into public.round_participants (round_id, name, amount_usd, is_lead)
      select rid, x->>'name', (x->>'amount_usd')::numeric, coalesce((x->>'lead')::boolean, false)
      from jsonb_array_elements(rd->'participants') x;
    end loop;

    for f in select * from jsonb_array_elements(coalesce(c->'founders', '[]')) loop
      insert into public.startup_founders (startup_id, full_name, role)
      select sid, f->>'name', f->>'role'
      where not exists (select 1 from public.startup_founders x where x.startup_id = sid and x.full_name = f->>'name');
    end loop;

    for m in select * from jsonb_array_elements(coalesce(c->'metrics', '[]')) loop
      insert into public.startup_metrics (startup_id, metric_key, value, unit, period, source, verification)
      select sid, m->>'key', (m->>'value')::numeric, m->>'unit', m->>'period', m->>'source', 'public_source'
      where not exists (select 1 from public.startup_metrics x where x.startup_id = sid and x.metric_key = m->>'key' and x.period = m->>'period' and x.source = m->>'source');
    end loop;

    insert into public.startup_round_outlook (startup_id, likelihood, expected_window, rationale, signals, assessed_at)
    values (sid, (c->'outlook'->>'likelihood')::public.round_likelihood, c->'outlook'->>'window', c->'outlook'->>'rationale',
            pg_temp.text_array(c->'outlook'->'signals'), now())
    on conflict (startup_id) do update set likelihood = excluded.likelihood, expected_window = excluded.expected_window,
      rationale = excluded.rationale, signals = excluded.signals, assessed_at = excluded.assessed_at
      where public.startup_round_outlook.assessed_by is null;

    if not exists (select 1 from public.startup_readiness_tasks t where t.startup_id = sid) then
      insert into public.startup_readiness_tasks (startup_id, title, sort_order)
      select sid, defaults[i], i from generate_subscripts(defaults, 1) as i;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function pg_temp.load_investors(j jsonb) returns int language plpgsql as $$
declare i jsonb; oid uuid; iid uuid; n int := 0;
begin
  for i in select * from jsonb_array_elements(j->'investors') loop
    select o.id into oid from public.organizations o where o.type = 'investor' and o.name = i->>'name';
    if oid is null then
      insert into public.organizations (type, name, country, is_demo) values ('investor', i->>'name', i->>'country', false) returning id into oid;
    else
      update public.organizations set country = i->>'country' where id = oid;
    end if;

    insert into public.investors (org_id, category, headquarters, description, evidence_type, evidence_summary, evidence_url, evidence_date, uzbek_companies)
    values (oid, (i->>'category')::public.investor_category, i->>'city', 'Public profile compiled from the cited source. Sectors and stages are inferred from that source, not stated by the investor. Relationship not yet established.',
            i->>'evidence_type', i->>'evidence', i->>'url', (i->>'date')::date, pg_temp.text_array(i->'companies'))
    on conflict (org_id) do update set evidence_type = excluded.evidence_type,
      evidence_summary = excluded.evidence_summary, evidence_url = excluded.evidence_url, evidence_date = excluded.evidence_date,
      uzbek_companies = excluded.uzbek_companies
    returning id into iid;

    insert into public.investor_preferences (investor_id, sectors, stages, geographies, min_check, max_check, central_asia_interest)
    values (iid, pg_temp.text_array(i->'sectors'), pg_temp.text_array(i->'stages'),
            case when (i->>'ca')::boolean then array['Central Asia'] else '{}'::text[] end,
            (i->>'min')::numeric, (i->>'max')::numeric, coalesce((i->>'ca')::boolean, false))
    on conflict (investor_id) do nothing;

    insert into public.investor_relationships (investor_id, status, priority, tags)
    values (iid, 'identified', 'medium', case when (i->>'suggested_priority')::boolean then array['suggested-priority'] else '{}'::text[] end)
    on conflict (investor_id) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

select pg_temp.load_portfolio($portfolio$__PORTFOLIO_JSON__$portfolio$::jsonb) as portfolio_loaded,
       pg_temp.load_investors($investors$__INVESTORS_JSON__$investors$::jsonb) as investors_loaded;
