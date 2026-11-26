import { Badge, EmptyState } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { date, usd } from "@/lib/format";
import { isRecordKind } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type PublicRecord = Database["public"]["Tables"]["startup_public_records"]["Row"];

/** Sourced public information about a company. Summaries are stored in English, as published. */
export async function PublicRecordsList({ records, emptyBody }: { records: PublicRecord[]; emptyBody?: string }) {
  const { t, locale } = await getI18n();
  if (records.length === 0) return <EmptyState title={t.startups.noRecords}>{emptyBody}</EmptyState>;
  return (
    <ul className="divide-y divide-line">
      {records.map((r) => (
        <li key={r.id} className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone={r.kind === "funding" ? "pos" : "neutral"}>{isRecordKind(r.kind) ? t.enums.record_kind[r.kind] : r.kind}</Badge>
            <span>{r.publisher}</span>
            {r.published_on && <span>· {date(r.published_on, locale)}</span>}
            {r.amount_usd != null && <span className="tabular font-medium text-ink-2">· {usd(r.amount_usd)}</span>}
          </div>
          <a href={r.url} target="_blank" rel="noreferrer noopener" className="mt-1 block font-medium hover:text-brand-600 hover:underline">
            {r.title} <span aria-hidden>↗</span>
          </a>
          <p className="mt-0.5 text-sm text-ink-2">{r.summary}</p>
          {r.co_investors.length > 0 && <p className="mt-1 text-xs text-muted">{r.co_investors.join(" · ")}</p>}
        </li>
      ))}
    </ul>
  );
}
