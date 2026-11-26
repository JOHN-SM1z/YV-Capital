import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getPortfolio } from "@/lib/portfolio";
import { getFollowedIds } from "@/lib/funding";
import { FollowButton } from "@/components/follow-button";
import { CompanyLogo } from "@/components/company-logo";
import { ButtonLink, Card, EmptyState, Input, PageHeader, Select, buttonClass } from "@/components/ui";
import { isRoundType } from "@/lib/labels";
import { date, usd } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.portfolio };
}

export default async function PortfolioPage({ searchParams }: PageProps<"/investor/portfolio">) {
  const user = await requireUser(["investor"]);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const sector = typeof sp.sector === "string" ? sp.sector : "";
  const onlyFollowing = sp.following === "1";
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const p = t.investorPortal;
  const [portfolio, followed] = await Promise.all([getPortfolio(supabase), getFollowedIds(supabase, user.id)]);
  const sectors = [...new Set(portfolio.flatMap((c) => (c.sector ? [c.sector] : [])))].sort();
  const companies = portfolio
    .filter(
      (c) => (!sector || c.sector === sector) && (!onlyFollowing || followed.has(c.id)) && (!q || `${c.name} ${c.one_liner ?? ""}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.record_count - a.record_count || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title={p.portfolioTitle} description={fmt(p.portfolioSub, { n: portfolio.length })} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder={t.startups.searchPh} className="max-w-64" aria-label={t.common.search} />
        <Select name="sector" defaultValue={sector} className="max-w-52" aria-label={t.common.sector}>
          <option value="">{t.startups.allSectors}</option>
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="following" value="1" defaultChecked={onlyFollowing} className="size-4 accent-brand" />
          {t.follow.filterFollowing} ({followed.size})
        </label>
        <button className={buttonClass("dark")}>{t.common.filter}</button>
      </form>
      <p className="mb-4 text-xs text-muted">{t.follow.explainer}</p>
      {companies.length === 0 ? (
        <Card>
          <EmptyState title={t.startups.noMatch} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-center gap-3">
                  <CompanyLogo name={c.name} url={c.logo_url} size={44} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{c.name}</h2>
                    <p className="text-xs text-muted">
                      {[c.sector, c.funding_stage && isRoundType(c.funding_stage) ? t.enums.funding_stage[c.funding_stage] : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <FollowButton startupId={c.id} name={c.name} following={followed.has(c.id)} t={t} />
                </div>
                <p className="mt-3 flex-1 text-sm text-ink-2">{c.one_liner}</p>
                <p className="mt-3 text-xs font-medium text-ink-2">
                  {c.round_count > 0
                    ? fmt(t.funding.cardLine, { amount: c.disclosed_usd != null ? usd(c.disclosed_usd) : "—", n: c.round_count })
                    : t.funding.cardNoRounds}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-xs text-muted">{c.last_record_on ? fmt(p.lastRecord, { date: date(c.last_record_on, locale) }) : ""}</span>
                  <ButtonLink href={`/investor/portfolio/${c.id}`} variant={c.record_count > 1 ? "primary" : "secondary"} size="sm">
                    {fmt(p.viewRecords, { n: c.record_count })}
                  </ButtonLink>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
