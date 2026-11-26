import type { ReactNode } from "react";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { date, usd } from "@/lib/format";
import { isRoundType } from "@/lib/labels";
import { summarizeRounds } from "@/lib/funding-stats";
import type { FundingRound } from "@/lib/funding";

/**
 * Crunchbase-style funding history for one company, built only from sourced rounds.
 * `renderActions` lets staff pages add a remove control per round.
 */
export async function FundingCard({
  rounds,
  renderActions,
  footer,
}: {
  rounds: FundingRound[];
  renderActions?: (r: FundingRound) => ReactNode;
  footer?: ReactNode;
}) {
  const { t, locale } = await getI18n();
  const f = t.funding;
  const s = summarizeRounds(rounds);

  return (
    <Card>
      <CardHeader title={f.title} description={f.sub} />
      {rounds.length === 0 ? (
        <EmptyState title={f.noRounds}>{f.noRoundsBody}</EmptyState>
      ) : (
        <>
          <dl className="grid grid-cols-3 divide-x divide-line border-b border-line">
            {[
              [f.disclosed, s.disclosedUsd != null ? usd(s.disclosedUsd) : "—"],
              [f.rounds, String(s.roundCount)],
              [f.lastReported, s.lastReportedOn ? date(s.lastReportedOn, locale) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="px-5 py-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="tabular mt-0.5 font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <ol className="divide-y divide-line">
            {rounds.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="tabular font-semibold">{r.amountUsd != null ? usd(r.amountUsd) : f.amountUndisclosed}</span>
                  <Badge tone={r.roundType ? "brand" : "neutral"}>
                    {r.roundType && isRoundType(r.roundType) ? t.enums.funding_stage[r.roundType] : f.typeUndisclosed}
                  </Badge>
                  <span className="text-xs text-muted">{r.announcedOn ? fmt(f.reported, { date: date(r.announcedOn, locale) }) : f.dateNotGiven}</span>
                  {renderActions && <span className="ml-auto">{renderActions(r)}</span>}
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {r.participants.map((p) => (
                    <li key={p.name} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-xs">
                      <span className="font-medium text-ink">{p.name}</span>
                      {p.amountUsd != null && <span className="tabular text-muted">{usd(p.amountUsd)}</span>}
                      {p.isLead && <Badge tone="dark">{f.lead}</Badge>}
                    </li>
                  ))}
                </ul>
                {r.note && <p className="mt-2 text-xs text-ink-2">{r.note}</p>}
                {r.source && (
                  <a
                    href={r.source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-block text-xs text-muted hover:text-brand-600 hover:underline"
                  >
                    {f.source}: {r.source.publisher} — {r.source.title} <span aria-hidden>↗</span>
                  </a>
                )}
              </li>
            ))}
          </ol>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            {f.disclaimer}
            {s.undisclosedCount > 0 && <> {fmt(f.undisclosedNote, { n: s.undisclosedCount })}</>}
          </p>
        </>
      )}
      {footer}
    </Card>
  );
}
