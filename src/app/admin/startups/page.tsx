import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { CompanyLogo } from "@/components/company-logo";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th, buttonClass } from "@/components/ui";
import { LIKELIHOOD_ORDER, LIKELIHOOD_TONE, SECTORS, isRoundType } from "@/lib/labels";
import { date, usd } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { Constants } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.startups };
}

const LIKELIHOODS = Constants.public.Enums.round_likelihood;

/**
 * Every company with its next-round status (internal outlook), last reported round and public records.
 * Opening a company shows the outlook's reasons and every public record with its source.
 */
export default async function StartupsPage({ searchParams }: PageProps<"/admin/startups">) {
  await requireUser(STAFF);
  const sp = await searchParams;
  const param = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : "";
  };
  const { t, locale } = await getI18n();
  const supabase = await createClient();
  const outlookFilter = LIKELIHOODS.find((l) => l === param("outlook"));

  let query = supabase
    .from("startups")
    .select(
      "id, name, sector, one_liner, logo_url, stage, funding_stage, is_portfolio, yv_check_usd, user_profiles!startups_owner_id_fkey(full_name), startup_round_outlook(likelihood, expected_window)",
    )
    .is("deleted_at", null)
    .order("name");
  const stage = Constants.public.Enums.pipeline_stage.find((s) => s === param("stage"));
  if (stage) query = query.eq("stage", stage);
  if (param("sector")) query = query.eq("sector", param("sector"));
  if (param("q")) query = query.ilike("name", `%${param("q").replace(/[%_\\]/g, "")}%`);
  if (param("view") === "pipeline") query = query.neq("stage", "submitted");

  const [startupsRes, recordsRes, roundsRes] = await Promise.all([
    query,
    supabase.from("startup_public_records").select("startup_id"),
    supabase.from("funding_rounds").select("startup_id, announced_on, amount_usd").order("announced_on", { ascending: false, nullsFirst: false }),
  ]);
  const all = rows(startupsRes, "startups");
  const recordCount = new Map<string, number>();
  for (const r of rows(recordsRes, "record counts")) recordCount.set(r.startup_id, (recordCount.get(r.startup_id) ?? 0) + 1);
  // Rounds arrive newest first, so the first one per company is its last reported round.
  const lastRound = new Map<string, { announced_on: string | null; amount_usd: number | null }>();
  for (const r of rows(roundsRes, "last rounds")) if (!lastRound.has(r.startup_id)) lastRound.set(r.startup_id, r);

  const countBy = (l: (typeof LIKELIHOODS)[number]) => all.filter((s) => s.startup_round_outlook?.likelihood === l).length;
  const startups = outlookFilter
    ? all
        .filter((s) => s.startup_round_outlook?.likelihood === outlookFilter)
        .sort((a, b) => (recordCount.get(b.id) ?? 0) - (recordCount.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    : param("sort") === "outlook"
      ? [...all].sort(
          (a, b) =>
            (a.startup_round_outlook ? LIKELIHOOD_ORDER[a.startup_round_outlook.likelihood] : 9) -
              (b.startup_round_outlook ? LIKELIHOOD_ORDER[b.startup_round_outlook.likelihood] : 9) || a.name.localeCompare(b.name),
        )
      : all;

  // Status chips keep the other filters.
  const hrefWith = (outlook: string | null) => {
    const next = new URLSearchParams();
    for (const k of ["q", "view", "stage", "sector"]) if (param(k)) next.set(k, param(k));
    if (outlook) next.set("outlook", outlook);
    const s = next.toString();
    return s ? `/admin/startups?${s}` : "/admin/startups";
  };

  return (
    <>
      <PageHeader
        title={t.startups.title}
        description={t.startups.subtitle}
        actions={
          <ButtonLink href="/admin/startups/new" variant="primary">
            {t.startups.add}
          </ButtonLink>
        }
      />

      <nav aria-label={t.startups.colOutlook} className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">{t.startups.colOutlook}:</span>
        <Link href={hrefWith(null)} aria-current={!outlookFilter ? "page" : undefined}>
          <Badge tone={!outlookFilter ? "dark" : "neutral"}>
            {t.common.all} · {all.length}
          </Badge>
        </Link>
        {LIKELIHOODS.map((l) => (
          <Link key={l} href={hrefWith(l)} aria-current={outlookFilter === l ? "page" : undefined}>
            <Badge tone={outlookFilter === l ? "dark" : LIKELIHOOD_TONE[l]}>
              {t.enums.round_likelihood[l]} · {countBy(l)}
            </Badge>
          </Link>
        ))}
      </nav>

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        {outlookFilter && <input type="hidden" name="outlook" value={outlookFilter} />}
        <Input name="q" defaultValue={param("q")} placeholder={t.startups.searchPh} className="max-w-56" aria-label={t.common.search} />
        <Select name="view" defaultValue={param("view")} className="max-w-56" aria-label={t.startups.allCompanies}>
          <option value="">{t.startups.allCompanies}</option>
          <option value="pipeline">{t.startups.inPipeline}</option>
        </Select>
        <Select name="stage" defaultValue={param("stage")} className="max-w-64" aria-label={t.common.stage}>
          <option value="">{t.startups.allStages}</option>
          {Constants.public.Enums.pipeline_stage.map((s) => (
            <option key={s} value={s}>
              {t.enums.pipeline_stage[s]}
            </option>
          ))}
        </Select>
        <Select name="sector" defaultValue={param("sector")} className="max-w-48" aria-label={t.common.sector}>
          <option value="">{t.startups.allSectors}</option>
          {SECTORS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select name="sort" defaultValue={param("sort")} className="max-w-64" aria-label={t.startups.sortBy}>
          <option value="">{t.startups.sortName}</option>
          <option value="outlook">{t.startups.sortOutlook}</option>
        </Select>
        <button className={buttonClass("dark")}>{t.common.filter}</button>
      </form>

      <Card>
        {startups.length === 0 ? (
          <EmptyState
            title={t.startups.noMatch}
            action={
              <Link href="/admin/startups" className="text-sm font-medium text-brand-600">
                {t.common.clearFilters}
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t.startups.colCompany}</Th>
                <Th>{t.startups.colOutlook}</Th>
                <Th>{t.funding.lastRound}</Th>
                <Th>{t.startups.colCheck}</Th>
                <Th>{t.startups.colStage}</Th>
                <Th>{t.startups.colOwner}</Th>
                <Th className="text-right">{t.nextRounds.colRecords}</Th>
              </tr>
            </thead>
            <tbody>
              {startups.map((s) => {
                const outlook = s.startup_round_outlook;
                const round = lastRound.get(s.id);
                const n = recordCount.get(s.id) ?? 0;
                return (
                  <tr key={s.id} className="hover:bg-surface/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <CompanyLogo name={s.name} url={s.logo_url} size={36} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/admin/startups/${s.id}`} className="font-medium whitespace-nowrap hover:underline">
                              {s.name}
                            </Link>
                            {s.is_portfolio && <Badge tone="brand">{t.startups.portfolioBadge}</Badge>}
                          </div>
                          <p className="max-w-72 truncate text-xs text-muted">{[s.sector, s.one_liner].filter(Boolean).join(" · ")}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {outlook ? (
                        <>
                          <Badge tone={LIKELIHOOD_TONE[outlook.likelihood]}>{t.enums.round_likelihood[outlook.likelihood]}</Badge>
                          {outlook.expected_window && <p className="mt-0.5 text-xs whitespace-nowrap text-muted">{outlook.expected_window}</p>}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="tabular whitespace-nowrap">
                      {round ? (
                        <>
                          <span className="font-medium">{round.amount_usd != null ? usd(round.amount_usd) : t.funding.amountUndisclosed}</span>
                          <span className="block text-xs text-muted">
                            {[
                              s.funding_stage && isRoundType(s.funding_stage) ? t.enums.funding_stage[s.funding_stage] : null,
                              round.announced_on ? date(round.announced_on, locale) : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="tabular">{usd(s.yv_check_usd)}</Td>
                    <Td>
                      <Badge tone={s.stage === "submitted" ? "neutral" : s.stage === "rejected" ? "neg" : "info"}>{t.enums.pipeline_stage[s.stage]}</Badge>
                    </Td>
                    <Td className="text-ink-2">{s.user_profiles?.full_name ?? <span className="text-muted">{t.common.unassigned}</span>}</Td>
                    <Td className="text-right">
                      <ButtonLink href={`/admin/startups/${s.id}#records`} size="sm" variant={n > 1 ? "primary" : "secondary"}>
                        {fmt(t.investorPortal.viewRecords, { n })}
                      </ButtonLink>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">{t.nextRounds.method}</p>
      <p className="mt-1 text-xs text-muted">{t.startups.footnote}</p>
    </>
  );
}
