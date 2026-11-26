import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getMyOpportunities } from "@/lib/investor-data";
import { CompanyLogo } from "@/components/company-logo";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { INTEREST_TONE, OPPORTUNITY_TONE, isRoundType } from "@/lib/labels";
import { usd, usdRange } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.opportunities };
}

export default async function InvestorOpportunities() {
  await requireUser(["investor"]);
  const supabase = await createClient();
  const { t } = await getI18n();
  const p = t.investorPortal;
  const [opps, interestsRes] = await Promise.all([getMyOpportunities(supabase), supabase.from("investor_interests").select("opportunity_id, level")]);
  const interestBy = new Map(rows(interestsRes, "interests").map((i) => [i.opportunity_id, i.level]));

  return (
    <>
      <PageHeader title={p.oppsTitle} description={p.oppsSub} />
      {opps.length === 0 ? (
        <Card>
          <EmptyState title={p.noOpps}>{p.noOppsBody}</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {opps.map((o) => {
            const level = interestBy.get(o.id);
            const stage = o.stage && isRoundType(o.stage) ? t.enums.funding_stage[o.stage] : null;
            return (
              <Link key={o.id} href={`/investor/opportunities/${o.id}`} className="group">
                <Card className="h-full p-5 transition-colors group-hover:border-brand/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CompanyLogo name={o.startup?.name ?? o.title} url={o.startup?.logo_url} />
                      <div>
                        <p className="font-semibold">{o.startup?.name ?? o.title}</p>
                        <p className="text-xs text-muted">{[o.sector, o.startup?.country, stage].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                    {o.status !== "shared" && <Badge tone={OPPORTUNITY_TONE[o.status]}>{t.enums.opportunity_status[o.status]}</Badge>}
                  </div>
                  {o.thesis && <p className="mt-3 line-clamp-2 text-sm text-ink-2">{o.thesis}</p>}
                  {o.traction_highlights && <p className="mt-2 line-clamp-2 text-xs text-muted">{o.traction_highlights}</p>}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                    <span>
                      <span className="text-muted">{p.raising}</span> <span className="tabular font-medium">{usd(o.target_amount)}</span>{" "}
                      <span className="text-xs text-muted">· {fmt(p.tickets, { range: usdRange(o.min_ticket, o.max_ticket) })}</span>
                    </span>
                    {level ? <Badge tone={INTEREST_TONE[level]}>{t.enums.interest_level[level]}</Badge> : <Badge tone="warn">{p.awaitingResponse}</Badge>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
