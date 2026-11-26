import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { rows } from "@/lib/db";
import { participantKey } from "@/lib/funding-stats";
import { CompanyLogo } from "@/components/company-logo";
import { Badge, Card, CardHeader, EmptyState, Input, PageHeader, buttonClass } from "@/components/ui";
import { isRecordKind } from "@/lib/labels";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.search.title };
}

const LIMIT = 12;

/** Escapes LIKE wildcards and the characters PostgREST uses to separate `or` filters. */
function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()"]/g, " ")}%`;
}

/** One search box across companies, investors, public records and round participants (staff only; RLS applies). */
export default async function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  await requireUser(STAFF);
  const { t } = await getI18n();
  const sr = t.search;
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 80);
  const supabase = await createClient();

  let body = <EmptyState title={sr.minChars} />;
  if (q.length >= 2) {
    const term = likeTerm(q);
    const [companiesRes, orgsRes, recordsRes, participantsRes] = await Promise.all([
      supabase
        .from("startups")
        .select("id, name, sector, one_liner, logo_url, is_portfolio")
        .is("deleted_at", null)
        .or(`name.ilike.${term},sector.ilike.${term},one_liner.ilike.${term}`)
        .order("name")
        .limit(LIMIT),
      supabase
        .from("investors")
        .select("id, headquarters, evidence_summary, organizations!inner(name, country)")
        .ilike("organizations.name", term)
        .limit(LIMIT),
      supabase
        .from("startup_public_records")
        .select("id, title, publisher, kind, startup_id, startups(name)")
        .or(`title.ilike.${term},publisher.ilike.${term},summary.ilike.${term}`)
        .order("published_on", { ascending: false, nullsFirst: false })
        .limit(LIMIT),
      supabase.from("round_participants").select("name, funding_rounds(startup_id, startups(name))").ilike("name", term).limit(50),
    ]);
    const companies = rows(companiesRes, "search companies");
    const investors = rows(orgsRes, "search investors");
    const records = rows(recordsRes, "search records");
    // Group participants by fund so "IT Park Ventures" appears once with all its companies.
    const funds = new Map<string, { name: string; companies: Map<string, string> }>();
    for (const p of rows(participantsRes, "search participants")) {
      const key = participantKey(p.name);
      const entry = funds.get(key) ?? { name: p.name, companies: new Map<string, string>() };
      if (p.funding_rounds?.startups) entry.companies.set(p.funding_rounds.startup_id, p.funding_rounds.startups.name);
      funds.set(key, entry);
    }

    const total = companies.length + investors.length + records.length + funds.size;
    body =
      total === 0 ? (
        <EmptyState title={fmt(sr.noResults, { q })} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {companies.length > 0 && (
            <Card>
              <CardHeader title={`${sr.companies} · ${companies.length}`} />
              <ul className="divide-y divide-line">
                {companies.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/startups/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface/60">
                      <CompanyLogo name={c.name} url={c.logo_url} size={32} />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {c.name} {c.is_portfolio && <Badge tone="brand">{t.startups.portfolioBadge}</Badge>}
                        </span>
                        <span className="block truncate text-xs text-muted">{[c.sector, c.one_liner].filter(Boolean).join(" · ")}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {investors.length > 0 && (
            <Card>
              <CardHeader title={`${sr.investors} · ${investors.length}`} />
              <ul className="divide-y divide-line">
                {investors.map((i) => (
                  <li key={i.id}>
                    <Link href={`/admin/investors/${i.id}`} className="block px-5 py-3 hover:bg-surface/60">
                      <span className="font-medium">{i.organizations.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {[i.headquarters, i.organizations.country].filter(Boolean).join(", ")}
                        {i.evidence_summary && ` · ${i.evidence_summary}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {funds.size > 0 && (
            <Card>
              <CardHeader title={`${sr.coInvestors} · ${funds.size}`} />
              <ul className="divide-y divide-line">
                {[...funds.values()].map((f) => (
                  <li key={f.name} className="px-5 py-3">
                    <p className="font-medium">{f.name}</p>
                    <p className="text-xs text-muted">
                      {fmt(sr.inRounds, { companies: "" })}
                      {[...f.companies].map(([id, name], i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          <Link href={`/admin/startups/${id}`} className="text-brand-600 hover:underline">
                            {name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {records.length > 0 && (
            <Card>
              <CardHeader title={`${sr.records} · ${records.length}`} />
              <ul className="divide-y divide-line">
                {records.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/startups/${r.startup_id}#records`} className="block px-5 py-3 hover:bg-surface/60">
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <Badge>{isRecordKind(r.kind) ? t.enums.record_kind[r.kind] : r.kind}</Badge>
                        {r.publisher} · {r.startups?.name}
                      </span>
                      <span className="mt-0.5 block text-sm font-medium">{r.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      );
  }

  return (
    <>
      <PageHeader title={sr.title} description={sr.sub} />
      <form role="search" className="mb-6 flex max-w-xl gap-2">
        <Input name="q" defaultValue={q} placeholder={sr.ph} aria-label={t.common.search} autoFocus />
        <button className={buttonClass("dark")}>{t.common.search}</button>
      </form>
      {q.length >= 2 ? body : <Card>{body}</Card>}
    </>
  );
}
