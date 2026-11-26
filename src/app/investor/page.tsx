import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getMyOpportunities } from "@/lib/investor-data";
import { getPortfolio } from "@/lib/portfolio";
import { CompanyLogo } from "@/components/company-logo";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { INTEREST_TONE, MEETING_TONE, OPPORTUNITY_TONE } from "@/lib/labels";
import { date, dateTime, daysAgoMs, usd } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.overview };
}

export default async function InvestorOverview() {
  const me = await requireUser(["investor"]);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const p = t.investorPortal;
  const [opps, interestsRes, questionsRes, meetingsRes, portfolio] = await Promise.all([
    getMyOpportunities(supabase),
    supabase.from("investor_interests").select("opportunity_id, level"),
    supabase.from("due_diligence_requests").select("id, status"),
    supabase.from("meetings").select("id, title, starts_at, status").neq("status", "cancelled").order("starts_at", { ascending: true }),
    getPortfolio(supabase),
  ]);
  const interestBy = new Map(rows(interestsRes, "interests").map((i) => [i.opportunity_id, i.level]));
  const weekAgo = daysAgoMs(7);
  const newOnes = opps.filter((o) => o.shared_at && Date.parse(o.shared_at) > weekAgo && !interestBy.has(o.id)).length;
  const pending = rows(questionsRes, "questions").filter((q) => q.status !== "released" && q.status !== "closed").length;
  const nowIso = new Date().toISOString();
  const upcoming = rows(meetingsRes, "meetings").filter((m) => m.status === "requested" || (m.starts_at && m.starts_at >= nowIso));
  // Companies with the newest public records, as a window into the portfolio.
  const recent = [...portfolio]
    .filter((c) => c.record_count > 1)
    .sort((a, b) => (b.last_record_on ?? "").localeCompare(a.last_record_on ?? ""))
    .slice(0, 6);

  return (
    <>
      <PageHeader title={fmt(p.welcome, { name: me.fullName.split(" ")[0] || me.email })} description={fmt(p.overviewSub, { org: me.orgName })} />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={p.sharedWithYou} value={opps.length} />
        <Stat label={p.newThisWeek} value={newOnes} hint={p.notResponded} />
        <Stat label={p.awaitingAnswer} value={pending} />
        <Stat label={p.upcomingMeetings} value={upcoming.length} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={p.yourOpportunities}
              actions={
                <Link href="/investor/opportunities" className="text-sm font-medium text-brand-600">
                  {t.common.viewAll}
                </Link>
              }
            />
            {opps.length === 0 ? (
              <EmptyState title={p.nothingShared}>{p.nothingSharedBody}</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {opps.slice(0, 5).map((o) => {
                  const level = interestBy.get(o.id);
                  return (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <div>
                        <Link href={`/investor/opportunities/${o.id}`} className="font-medium hover:underline">
                          {o.title}
                        </Link>
                        <p className="text-xs text-muted">{[o.sector, fmt(p.raisingAmount, { amount: usd(o.target_amount) })].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="flex gap-1.5">
                        {o.status !== "shared" && <Badge tone={OPPORTUNITY_TONE[o.status]}>{t.enums.opportunity_status[o.status]}</Badge>}
                        {level ? <Badge tone={INTEREST_TONE[level]}>{t.enums.interest_level[level]}</Badge> : <Badge tone="warn">{p.awaitingResponse}</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={p.portfolioTitle}
              description={fmt(p.portfolioSub, { n: portfolio.length })}
              actions={
                <Link href="/investor/portfolio" className="text-sm font-medium text-brand-600">
                  {t.common.viewAll}
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo name={c.name} url={c.logo_url} size={34} />
                    <div className="min-w-0">
                      <p className="font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted">
                        {c.sector} · {fmt(p.lastRecord, { date: date(c.last_record_on, locale) })}
                      </p>
                    </div>
                  </div>
                  <Link href={`/investor/portfolio/${c.id}`} className="shrink-0 text-xs font-medium text-brand-600">
                    {fmt(p.viewRecords, { n: c.record_count })}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader
            title={t.nav.meetingsShort}
            actions={
              <Link href="/investor/meetings" className="text-sm font-medium text-brand-600">
                {t.common.all}
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {upcoming.length === 0 && <li className="px-5 py-3 text-sm text-muted">{p.noUpcoming}</li>}
            {upcoming.slice(0, 5).map((m) => (
              <li key={m.id} className="px-5 py-3 text-sm">
                <p>{m.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {m.starts_at ? dateTime(m.starts_at, locale) : p.tbc}
                  <Badge tone={MEETING_TONE[m.status]}>{t.enums.meeting_status[m.status]}</Badge>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
