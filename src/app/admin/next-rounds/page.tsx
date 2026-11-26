import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { CompanyLogo } from "@/components/company-logo";
import { Badge, Card, CardBody, PageHeader, Table, Td, Th } from "@/components/ui";
import { LIKELIHOOD_ORDER, LIKELIHOOD_TONE } from "@/lib/labels";
import { date, usd } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { Constants } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.nextRounds };
}

export default async function NextRoundsPage({ searchParams }: PageProps<"/admin/next-rounds">) {
  await requireUser(STAFF);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const { likelihood } = await searchParams;
  const selected = Constants.public.Enums.round_likelihood.find((v) => v === likelihood);

  const [outlookRes, recordsRes, roundsRes] = await Promise.all([
    supabase.from("startup_round_outlook").select("*, startups!inner(id, name, sector, logo_url, is_portfolio, deleted_at)").is("startups.deleted_at", null),
    supabase.from("startup_public_records").select("startup_id"),
    supabase.from("funding_rounds").select("startup_id, announced_on, amount_usd").order("announced_on", { ascending: false, nullsFirst: false }),
  ]);
  // Newest reported round per company (rounds arrive newest first).
  const lastRound = new Map<string, { announced_on: string | null; amount_usd: number | null }>();
  for (const r of rows(roundsRes, "last rounds")) if (!lastRound.has(r.startup_id)) lastRound.set(r.startup_id, r);
  const all = rows(outlookRes, "outlooks");
  const recordCount = new Map<string, number>();
  for (const r of rows(recordsRes, "record counts")) recordCount.set(r.startup_id, (recordCount.get(r.startup_id) ?? 0) + 1);

  const sorted = all
    .filter((o) => !selected || o.likelihood === selected)
    .sort(
      (a, b) =>
        LIKELIHOOD_ORDER[a.likelihood] - LIKELIHOOD_ORDER[b.likelihood] ||
        (recordCount.get(b.startup_id) ?? 0) - (recordCount.get(a.startup_id) ?? 0) ||
        a.startups.name.localeCompare(b.startups.name),
    );
  const assessed = all
    .map((o) => o.assessed_at)
    .sort()
    .at(-1);

  return (
    <>
      <PageHeader title={t.nextRounds.title} description={t.nextRounds.subtitle} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/next-rounds" aria-current={!selected ? "page" : undefined}>
          <Badge tone={!selected ? "dark" : "neutral"}>
            {t.common.all} · {all.length}
          </Badge>
        </Link>
        {Constants.public.Enums.round_likelihood.map((value) => (
          <Link key={value} href={`?likelihood=${value}`} aria-current={selected === value ? "page" : undefined}>
            <Badge tone={selected === value ? "dark" : LIKELIHOOD_TONE[value]}>
              {t.enums.round_likelihood[value]} · {all.filter((o) => o.likelihood === value).length}
            </Badge>
          </Link>
        ))}
      </div>

      <Card className="mb-4">
        <CardBody className="text-sm text-ink-2">
          {t.nextRounds.method}
          {assessed && <span className="text-muted"> · {fmt(t.startups.assessedOn, { date: date(assessed, locale) })}</span>}
        </CardBody>
      </Card>

      <Card>
        <p className="border-b border-line px-5 py-3 text-sm text-muted">{fmt(t.nextRounds.count, { n: sorted.length })}</p>
        <Table>
          <thead>
            <tr>
              <Th>{t.nextRounds.colCompany}</Th>
              <Th>{t.nextRounds.colLikelihood}</Th>
              <Th>{t.nextRounds.colWindow}</Th>
              <Th>{t.nextRounds.colWhy}</Th>
              <Th>{t.funding.lastRound}</Th>
              <Th>{t.nextRounds.colRecords}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.startup_id} className="hover:bg-surface/60">
                <Td>
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo name={o.startups.name} url={o.startups.logo_url} size={32} />
                    <div>
                      <Link href={`/admin/startups/${o.startup_id}`} className="font-medium whitespace-nowrap hover:underline">
                        {o.startups.name}
                      </Link>
                      <p className="text-xs text-muted">{o.startups.sector}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge tone={LIKELIHOOD_TONE[o.likelihood]}>{t.enums.round_likelihood[o.likelihood]}</Badge>
                </Td>
                <Td className="whitespace-nowrap">{o.expected_window ?? "—"}</Td>
                <Td className="max-w-96">
                  <p className="text-sm text-ink-2">{o.rationale}</p>
                  {o.signals.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {o.signals.map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  )}
                </Td>
                <Td className="tabular whitespace-nowrap">
                  {(() => {
                    const r = lastRound.get(o.startup_id);
                    if (!r) return <span className="text-muted">—</span>;
                    return (
                      <>
                        <span className="font-medium">{r.amount_usd != null ? usd(r.amount_usd) : t.funding.amountUndisclosed}</span>
                        <span className="block text-xs text-muted">{r.announced_on ? date(r.announced_on, locale) : t.funding.dateNotGiven}</span>
                      </>
                    );
                  })()}
                </Td>
                <Td className="tabular">{recordCount.get(o.startup_id) ?? 0}</Td>
                <Td className="text-right">
                  {o.likelihood !== "insufficient_data" && (
                    <Link href={`/admin/matching?startup=${o.startup_id}`} className="text-xs font-medium whitespace-nowrap text-brand-600">
                      {t.nextRounds.findInvestors}
                    </Link>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
