import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { CompanyLogo } from "@/components/company-logo";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th, buttonClass } from "@/components/ui";
import { LIKELIHOOD_TONE, SECTORS, isRoundType } from "@/lib/labels";
import { usd } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { Constants } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.startups };
}

export default async function StartupsPage({ searchParams }: PageProps<"/admin/startups">) {
  await requireUser(STAFF);
  const sp = await searchParams;
  const param = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : "";
  };
  const { t } = await getI18n();
  const supabase = await createClient();

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
  const startups = rows(await query, "startups");

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
      <form className="mb-4 flex flex-wrap gap-2" role="search">
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
                <Th>{t.startups.colSector}</Th>
                <Th>{t.startups.colCheck}</Th>
                <Th>{t.startups.colRound}</Th>
                <Th>{t.startups.colOutlook}</Th>
                <Th>{t.startups.colStage}</Th>
                <Th>{t.startups.colOwner}</Th>
              </tr>
            </thead>
            <tbody>
              {startups.map((s) => {
                const outlook = s.startup_round_outlook;
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
                          <p className="max-w-72 truncate text-xs text-muted">{s.one_liner}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-ink-2">{s.sector ?? "—"}</Td>
                    <Td className="tabular">{usd(s.yv_check_usd)}</Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      {s.funding_stage && isRoundType(s.funding_stage) ? t.enums.funding_stage[s.funding_stage] : "—"}
                    </Td>
                    <Td>
                      {outlook ? (
                        <>
                          <Badge tone={LIKELIHOOD_TONE[outlook.likelihood]}>{t.enums.round_likelihood[outlook.likelihood]}</Badge>
                          {outlook.expected_window && <p className="mt-0.5 text-xs whitespace-nowrap text-muted">{outlook.expected_window}</p>}
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <Badge tone={s.stage === "submitted" ? "neutral" : s.stage === "rejected" ? "neg" : "info"}>{t.enums.pipeline_stage[s.stage]}</Badge>
                    </Td>
                    <Td className="text-ink-2">{s.user_profiles?.full_name ?? <span className="text-muted">{t.common.unassigned}</span>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">{t.startups.footnote}</p>
    </>
  );
}
