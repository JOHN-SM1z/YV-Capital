import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th, buttonClass } from "@/components/ui";
import { EVIDENCE_TONE, FUNDING_STAGES, RELATIONSHIP_TONE, SECTORS, isEvidenceType, isRoundType } from "@/lib/labels";
import { date, todayTashkent, usdRange } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { Constants } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.investors };
}

const CHECK_SIZES = [50_000, 100_000, 250_000, 500_000, 1_000_000, 3_000_000];
const EVIDENCE_TYPES = ["investment", "partnership", "stated_interest"] as const;

export default async function InvestorsPage({ searchParams }: PageProps<"/admin/investors">) {
  await requireUser(STAFF);
  const sp = await searchParams;
  const param = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : "";
  };
  const q = param("q").trim().toLowerCase();
  const { t, locale } = await getI18n();

  const supabase = await createClient();
  const investors = rows(
    await supabase
      .from("investors")
      .select(
        "id, category, headquarters, evidence_type, uzbek_companies, organizations(name, country, is_demo), investor_preferences(sectors, stages, min_check, max_check, central_asia_interest), investor_relationships(status, priority, tags, next_follow_up_at, user_profiles!investor_relationships_owner_id_fkey(full_name))",
      ),
    "investors",
  );

  const matches = investors.filter((r) => {
    const org = r.organizations;
    const prefs = r.investor_preferences;
    const rel = r.investor_relationships;
    if (q && !`${org.name} ${org.country ?? ""} ${r.headquarters ?? ""} ${r.uzbek_companies.join(" ")}`.toLowerCase().includes(q)) return false;
    if (param("category") && r.category !== param("category")) return false;
    if (param("status") && rel?.status !== param("status")) return false;
    if (param("sector") && !prefs?.sectors.includes(param("sector"))) return false;
    if (param("stage") && !prefs?.stages.includes(param("stage"))) return false;
    if (param("evidence") && r.evidence_type !== param("evidence")) return false;
    if (param("ca") === "1" && !prefs?.central_asia_interest) return false;
    const check = Number(param("check"));
    if (check) {
      if (prefs?.min_check != null && prefs.min_check > check) return false;
      if (prefs?.max_check != null && prefs.max_check < check) return false;
    }
    return true;
  });
  // Suggested-priority relationships first, then alphabetical; test organizations last.
  const rank = (r: (typeof matches)[number]) => (r.organizations.is_demo ? 2 : r.investor_relationships?.tags.includes("suggested-priority") ? 0 : 1);
  const sorted = [...matches].sort((a, b) => rank(a) - rank(b) || a.organizations.name.localeCompare(b.organizations.name));
  const real = investors.filter((r) => !r.organizations.is_demo);
  const countries = new Set(real.map((r) => r.organizations.country).filter(Boolean));
  const today = todayTashkent();

  return (
    <>
      <PageHeader
        title={t.investors.title}
        description={fmt(t.investors.subtitle, { n: real.length, c: countries.size })}
        actions={
          <ButtonLink href="/admin/investors/new" variant="primary">
            {t.investors.add}
          </ButtonLink>
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <Input name="q" defaultValue={param("q")} placeholder={t.investors.searchPh} aria-label={t.common.search} />
        <Select name="evidence" defaultValue={param("evidence")} aria-label={t.investors.colEvidence}>
          <option value="">{t.investors.allEvidence}</option>
          {EVIDENCE_TYPES.map((e) => (
            <option key={e} value={e}>
              {t.enums.evidence_type[e]}
            </option>
          ))}
        </Select>
        <Select name="category" defaultValue={param("category")} aria-label={t.investors.colType}>
          <option value="">{t.investors.allTypes}</option>
          {Constants.public.Enums.investor_category.map((c) => (
            <option key={c} value={c}>
              {t.enums.investor_category[c]}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={param("status")} aria-label={t.common.status}>
          <option value="">{t.investors.allStatuses}</option>
          {Constants.public.Enums.relationship_status.map((s) => (
            <option key={s} value={s}>
              {t.enums.relationship_status[s]}
            </option>
          ))}
        </Select>
        <Select name="sector" defaultValue={param("sector")} aria-label={t.common.sector}>
          <option value="">{t.investors.allSectors}</option>
          {SECTORS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select name="stage" defaultValue={param("stage")} aria-label={t.common.stage}>
          <option value="">{t.investors.allStages}</option>
          {FUNDING_STAGES.map((s) => (
            <option key={s} value={s}>
              {t.enums.funding_stage[s]}
            </option>
          ))}
        </Select>
        <Select name="check" defaultValue={param("check")} aria-label={t.investors.colCheck}>
          <option value="">{t.investors.anyCheck}</option>
          {CHECK_SIZES.map((c) => (
            <option key={c} value={c}>
              {fmt(t.investors.canWrite, { amount: c >= 1e6 ? `$${c / 1e6}M` : `$${c / 1e3}K` })}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Select name="ca" defaultValue={param("ca")} aria-label={t.investors.caInterest}>
            <option value="">{t.investors.anyRegion}</option>
            <option value="1">{t.investors.caInterest}</option>
          </Select>
          <button className={buttonClass("dark")}>{t.common.filter}</button>
        </div>
      </form>

      <Card>
        {sorted.length === 0 ? (
          <EmptyState
            title={t.investors.noMatch}
            action={
              <Link href="/admin/investors" className="text-sm font-medium text-brand-600">
                {t.common.clearFilters}
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t.investors.colInvestor}</Th>
                <Th>{t.investors.colEvidence}</Th>
                <Th>{t.investors.colFocus}</Th>
                <Th>{t.investors.colCheck}</Th>
                <Th>{t.investors.colStatus}</Th>
                <Th>{t.investors.colOwner}</Th>
                <Th>{t.investors.colNext}</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const org = r.organizations;
                const prefs = r.investor_preferences;
                const rel = r.investor_relationships;
                const overdue = !!rel?.next_follow_up_at && rel.next_follow_up_at < today;
                return (
                  <tr key={r.id} className="hover:bg-surface/60">
                    <Td>
                      <Link href={`/admin/investors/${r.id}`} className="font-medium hover:underline">
                        {org.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span>{[org.country, t.enums.investor_category[r.category]].filter(Boolean).join(" · ")}</span>
                        {rel?.priority === "high" && <Badge tone="brand">{t.investors.priorityBadge}</Badge>}
                        {rel?.tags.includes("suggested-priority") && <Badge tone="info">{t.investors.suggested}</Badge>}
                      </div>
                    </Td>
                    <Td className="max-w-56">
                      {isEvidenceType(r.evidence_type) ? <Badge tone={EVIDENCE_TONE[r.evidence_type]}>{t.enums.evidence_type[r.evidence_type]}</Badge> : "—"}
                      {r.uzbek_companies.length > 0 && <p className="mt-1 text-xs text-muted">{r.uzbek_companies.join(", ")}</p>}
                    </Td>
                    <Td className="max-w-52 text-xs text-ink-2">
                      {prefs?.sectors.length ? prefs.sectors.join(", ") : t.investors.sectorAgnostic}
                      <div className="text-muted">{prefs?.stages.map((s) => (isRoundType(s) ? t.enums.funding_stage[s] : s)).join(", ")}</div>
                    </Td>
                    <Td className="tabular whitespace-nowrap">{usdRange(prefs?.min_check, prefs?.max_check)}</Td>
                    <Td>{rel && <Badge tone={RELATIONSHIP_TONE[rel.status]}>{t.enums.relationship_status[rel.status]}</Badge>}</Td>
                    <Td className="text-ink-2">{rel?.user_profiles?.full_name ?? <span className="text-muted">{t.common.unassigned}</span>}</Td>
                    <Td className={overdue ? "font-medium text-neg" : "text-ink-2"}>{date(rel?.next_follow_up_at, locale)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
