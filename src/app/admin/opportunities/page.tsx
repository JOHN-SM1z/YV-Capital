import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { Badge, Card, CardBody, EmptyState, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { createOpportunity } from "@/lib/actions/opportunities";
import { OPPORTUNITY_TONE } from "@/lib/labels";
import { date, usd } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.opportunities };
}

export default async function OpportunitiesPage() {
  await requireUser(STAFF);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const o = t.opportunities;
  const [oppsRes, accessRes, interestsRes, startupsRes] = await Promise.all([
    supabase
      .from("investment_opportunities")
      .select("id, title, status, target_amount, sector, updated_at, startups(name)")
      .order("updated_at", { ascending: false }),
    supabase.from("opportunity_access").select("opportunity_id"),
    supabase.from("investor_interests").select("opportunity_id, level"),
    supabase.from("startups").select("id, name").is("deleted_at", null).order("name"),
  ]);
  const opps = rows(oppsRes, "opportunities");
  const accessCount = new Map<string, number>();
  for (const a of rows(accessRes, "access")) accessCount.set(a.opportunity_id, (accessCount.get(a.opportunity_id) ?? 0) + 1);
  const interestCount = new Map<string, number>();
  for (const i of rows(interestsRes, "interests")) {
    if (i.level !== "declined") interestCount.set(i.opportunity_id, (interestCount.get(i.opportunity_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader title={o.title} description={o.subtitle} />
      <Card className="mb-6">
        <CardBody>
          <ActionForm action={createOpportunity} className="flex flex-wrap items-center gap-2">
            <Select name="startup_id" required className="max-w-80" aria-label={t.matching.colStartup}>
              <option value="">{t.common.choose}</option>
              {rows(startupsRes, "startups").map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <SubmitButton>{o.newDraft}</SubmitButton>
            <span className="text-xs text-muted">{o.prefillHint}</span>
          </ActionForm>
        </CardBody>
      </Card>
      <Card>
        {opps.length === 0 ? (
          <EmptyState title={o.none} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{o.colOpportunity}</Th>
                <Th>{o.colRaising}</Th>
                <Th>{o.colStatus}</Th>
                <Th>{o.colShared}</Th>
                <Th>{o.colInterest}</Th>
                <Th>{o.colUpdated}</Th>
              </tr>
            </thead>
            <tbody>
              {opps.map((opp) => (
                <tr key={opp.id} className="hover:bg-surface/60">
                  <Td>
                    <Link href={`/admin/opportunities/${opp.id}`} className="font-medium hover:underline">
                      {opp.title}
                    </Link>
                    <p className="text-xs text-muted">{[opp.startups.name, opp.sector].filter(Boolean).join(" · ")}</p>
                  </Td>
                  <Td className="tabular">{usd(opp.target_amount)}</Td>
                  <Td>
                    <Badge tone={OPPORTUNITY_TONE[opp.status]}>{t.enums.opportunity_status[opp.status]}</Badge>
                  </Td>
                  <Td className="tabular">{fmt(o.orgs, { n: accessCount.get(opp.id) ?? 0 })}</Td>
                  <Td className="tabular">{interestCount.get(opp.id) ?? 0}</Td>
                  <Td className="text-ink-2">{date(opp.updated_at, locale)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
