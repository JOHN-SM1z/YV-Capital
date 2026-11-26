import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getPortfolio } from "@/lib/portfolio";
import { getAllRounds, getInvestorFollowCounts } from "@/lib/funding";
import { capitalByMonth, capitalBySector, nameKeys, participantKey, rankCoInvestors, summarizeRounds } from "@/lib/funding-stats";
import { getInvestorsForMatch } from "@/lib/data";
import { rows } from "@/lib/db";
import { daysAgoMs, usd } from "@/lib/format";
import { CapitalChart } from "@/components/capital-chart";
import { CompanyLogo } from "@/components/company-logo";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, Table, Td, Th, buttonClass } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { INTL_LOCALE, fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.insights.title };
}

export default async function InsightsPage() {
  await requireUser(STAFF);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const ins = t.insights;
  const since = new Date(daysAgoMs(90)).toISOString().slice(0, 10);

  const [portfolio, allRounds, followCounts, recentRes, investors] = await Promise.all([
    getPortfolio(supabase),
    getAllRounds(supabase),
    getInvestorFollowCounts(supabase),
    supabase.from("startup_public_records").select("startup_id").gte("published_on", since),
    getInvestorsForMatch(supabase),
  ]);

  const byId = new Map(portfolio.map((c) => [c.id, c]));
  const rounds = allRounds.filter((r) => byId.has(r.startupId));
  const nameOf = (id: string) => byId.get(id)?.name ?? "—";
  const summary = summarizeRounds(rounds);
  const coInvestors = rankCoInvestors(rounds, nameOf);
  const investorByKey = new Map(investors.filter((i) => !i.isDemo).flatMap((i) => nameKeys(i.name).map((k) => [k, i.id] as const)));
  const monthFmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short", year: "numeric", timeZone: "UTC" });
  const months = capitalByMonth(rounds).map((m) => ({ ...m, label: monthFmt.format(new Date(`${m.month}-01T00:00:00Z`)) }));
  const sectors = capitalBySector(rounds, (id) => byId.get(id)?.sector ?? null);
  const companiesWithRounds = new Set(rounds.map((r) => r.startupId)).size;

  const recent = new Map<string, number>();
  for (const r of rows(recentRes, "recent records")) if (byId.has(r.startup_id)) recent.set(r.startup_id, (recent.get(r.startup_id) ?? 0) + 1);
  const attention = portfolio
    .map((c) => ({ c, followers: followCounts.get(c.id) ?? 0, recent: recent.get(c.id) ?? 0 }))
    .filter((a) => a.followers > 0 || a.recent > 0)
    .sort((a, b) => b.followers - a.followers || b.recent - a.recent || a.c.name.localeCompare(b.c.name))
    .slice(0, 10);

  return (
    <>
      <PageHeader title={ins.title} description={ins.sub} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={ins.kpiDisclosed} value={usd(summary.disclosedUsd)} hint={t.funding.disclaimer} />
        <Stat label={ins.kpiRounds} value={summary.roundCount} />
        <Stat label={ins.kpiCompanies} value={companiesWithRounds} hint={fmt(ins.kpiCompaniesOf, { n: portfolio.length })} />
        <Stat label={ins.kpiCoInvestors} value={coInvestors.length} />
      </div>

      {rounds.length === 0 ? (
        <Card>
          <EmptyState title={ins.empty}>{t.funding.noRoundsBody}</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader title={ins.byMonth} description={ins.byMonthSub} />
            <CardBody>
              <CapitalChart data={months} label={ins.byMonth} />
            </CardBody>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader title={ins.bySector} />
            <Table>
              <thead>
                <tr>
                  <Th>{ins.colSector}</Th>
                  <Th className="text-right">{t.funding.disclosed}</Th>
                  <Th className="text-right">{ins.colCompanies}</Th>
                </tr>
              </thead>
              <tbody>
                {sectors.map((s) => (
                  <tr key={s.sector}>
                    <Td>{s.sector}</Td>
                    <Td className="tabular text-right">{usd(s.usd)}</Td>
                    <Td className="tabular text-right">{s.companies}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader title={ins.coInvestors} description={ins.coInvestorsSub} />
            <Table>
              <thead>
                <tr>
                  <Th>{ins.colInvestor}</Th>
                  <Th className="text-right">{ins.colRounds}</Th>
                  <Th>{ins.colCompanies}</Th>
                </tr>
              </thead>
              <tbody>
                {coInvestors.map((c) => {
                  const investorId = investorByKey.get(participantKey(c.name));
                  return (
                    <tr key={c.name}>
                      <Td className="font-medium">
                        {investorId ? (
                          <Link href={`/admin/investors/${investorId}`} className="hover:underline">
                            {c.name}
                          </Link>
                        ) : (
                          c.name
                        )}
                        {c.ledRounds > 0 && <span className="ml-1.5 text-xs font-normal text-muted">({fmt(ins.led, { n: c.ledRounds })})</span>}
                      </Td>
                      <Td className="tabular text-right">{c.roundsWithYv}</Td>
                      <Td className="text-ink-2">{c.companies.join(", ")}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader title={ins.attention} description={ins.attentionSub} />
            {attention.length === 0 ? (
              <EmptyState title={ins.noAttention} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t.nextRounds.colCompany}</Th>
                    <Th className="text-right">{ins.colFollowers}</Th>
                    <Th className="text-right">{ins.colRecent}</Th>
                  </tr>
                </thead>
                <tbody>
                  {attention.map(({ c, followers, recent: n }) => (
                    <tr key={c.id}>
                      <Td>
                        <Link href={`/admin/startups/${c.id}`} className="flex items-center gap-2 font-medium hover:underline">
                          <CompanyLogo name={c.name} url={c.logo_url} size={24} />
                          {c.name}
                        </Link>
                      </Td>
                      <Td className="tabular text-right">{followers}</Td>
                      <Td className="tabular text-right">{n}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="border-t border-line px-5 py-3 text-xs text-muted">{t.follow.staffExplainer}</p>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title={ins.exportTitle} description={ins.exportNote} />
        <CardBody className="flex flex-wrap gap-2">
          {/* Plain links: the route handler re-checks the session and role, and logs each export. */}
          <a href="/api/export/portfolio" className={buttonClass("secondary", "sm")} download>
            {ins.exportPortfolio}
          </a>
          <a href="/api/export/investors" className={buttonClass("secondary", "sm")} download>
            {ins.exportInvestors}
          </a>
        </CardBody>
      </Card>
    </>
  );
}
