import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getInvestorsForMatch, getStartupsForMatch, realInvestors } from "@/lib/data";
import { rankInvestors, rankStartups, WEIGHTS } from "@/lib/matching/score";
import { FitBadge, MatchReasons } from "@/components/match-list";
import { Card, CardHeader, EmptyState, PageHeader, SandboxBadge, Select, Table, Td, Th, buttonClass } from "@/components/ui";
import { usdRange } from "@/lib/format";
import { isRoundType } from "@/lib/labels";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.matching };
}

export default async function MatchingPage({ searchParams }: PageProps<"/admin/matching">) {
  await requireUser(STAFF);
  const sp = await searchParams;
  const startupId = typeof sp.startup === "string" ? sp.startup : "";
  const investorId = typeof sp.investor === "string" ? sp.investor : "";
  const showNoFit = sp.all === "1";
  const { t } = await getI18n();
  const m = t.matching;

  const supabase = await createClient();
  const [investors, startups] = await Promise.all([getInvestorsForMatch(supabase), getStartupsForMatch(supabase)]);
  const startup = startups.find((s) => s.id === startupId);
  const investor = startup ? undefined : investors.find((i) => i.id === investorId);

  const results = startup
    ? rankInvestors(startup, realInvestors(investors)).map((r) => ({ id: r.investorId, name: r.investorName, ...r }))
    : investor
      ? rankStartups(investor, startups).map((r) => ({ id: r.startupId, name: r.startupName, ...r }))
      : [];
  const visible = showNoFit ? results : results.filter((r) => r.fit !== "none");
  const hidden = results.length - visible.length;
  const selected = startup ?? investor;
  const sandbox = new Set(investors.filter((i) => i.isDemo).map((i) => i.id));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const stageText = startup?.fundingStage && isRoundType(startup.fundingStage) ? t.enums.funding_stage[startup.fundingStage] : m.stageNotSet;

  return (
    <>
      <PageHeader
        title={m.title}
        description={fmt(m.subtitle, { check: WEIGHTS.check, stage: WEIGHTS.stage, sector: WEIGHTS.sector, geo: WEIGHTS.geography, co: WEIGHTS.coInvest })}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <form className="flex gap-2">
            <Select name="startup" defaultValue={startupId} aria-label={m.colStartup}>
              <option value="">{m.pickStartup}</option>
              {[...startups].sort(byName).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <button className={buttonClass("dark")}>{m.match}</button>
          </form>
        </Card>
        <Card className="p-4">
          <form className="flex gap-2">
            <Select name="investor" defaultValue={investorId} aria-label={m.colInvestor}>
              <option value="">{m.pickInvestor}</option>
              {[...investors].sort(byName).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
            <button className={buttonClass("dark")}>{m.match}</button>
          </form>
        </Card>
      </div>

      {!selected ? (
        <Card>
          <EmptyState title={m.emptyTitle}>{m.emptyBody}</EmptyState>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={fmt(startup ? m.investorsFor : m.startupsFor, { name: selected.name })}
            description={
              startup
                ? `${startup.sector ?? m.sectorNotSet} · ${stageText} · ${startup.roundTarget ? usdRange(startup.minTicket, startup.roundTarget) : m.roundNotRecorded}`
                : investor && `${investor.sectors.join(", ") || t.investors.sectorAgnostic} · ${usdRange(investor.minCheck, investor.maxCheck)}`
            }
            actions={
              <Link className="text-sm font-medium text-brand-600" href={`/admin/${startup ? "startups" : "investors"}/${selected.id}`}>
                {t.common.openProfile}
              </Link>
            }
          />
          {visible.length === 0 ? (
            <EmptyState title={m.noFits} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-16 text-right">{m.colScore}</Th>
                  <Th>{startup ? m.colInvestor : m.colStartup}</Th>
                  <Th>{m.colWhy}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <Td className="tabular text-right font-display text-lg font-semibold">{r.score}</Td>
                    <Td>
                      <Link href={`/admin/${startup ? "investors" : "startups"}/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <div className="mt-1 flex gap-1.5">
                        <FitBadge fit={r.fit} />
                        {sandbox.has(r.id) && <SandboxBadge label={t.common.sandbox} />}
                      </div>
                    </Td>
                    <Td>
                      <MatchReasons reasons={r.reasons} />
                    </Td>
                    <Td className="text-right">
                      {startup && r.fit !== "none" && (
                        <Link href={`/admin/startups/${startup.id}`} className="text-xs font-medium whitespace-nowrap text-brand-600">
                          {m.createShare}
                        </Link>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {hidden > 0 && (
            <p className="border-t border-line px-5 py-3 text-xs text-muted">
              {fmt(m.hidden, { n: hidden })}{" "}
              <Link className="text-brand-600" href={`?${startup ? "startup" : "investor"}=${selected.id}&all=1`}>
                {m.showThem}
              </Link>
            </p>
          )}
        </Card>
      )}
    </>
  );
}
