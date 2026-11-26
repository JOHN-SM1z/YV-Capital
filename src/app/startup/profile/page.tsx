import { requireUser } from "@/lib/auth";
import { getMyStartup } from "@/lib/founder-data";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { StartupProfileForm } from "@/components/startup-profile-form";
import { AddMetricForm, FundraisingForm } from "@/components/metric-forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, Input, PageHeader, Table, Td, Th } from "@/components/ui";
import { addFounder } from "@/lib/actions/startups";
import { VERIFICATION_TONE, isMetricKey } from "@/lib/labels";
import { date, metricValue } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.company };
}

export default async function FounderProfile() {
  await requireUser(["founder"]);
  const { supabase, startup } = await getMyStartup();
  const { t, locale } = await getI18n();
  const f = t.founderPortal;
  const [foundersRes, metricsRes, roundsRes] = await Promise.all([
    supabase.from("startup_founders").select("*").eq("startup_id", startup.id).order("created_at"),
    supabase.from("startup_metrics").select("*").eq("startup_id", startup.id).order("created_at", { ascending: false }),
    supabase.from("startup_fundraising").select("*").eq("startup_id", startup.id).order("created_at", { ascending: false }),
  ]);
  const founders = rows(foundersRes, "founders");
  const metrics = rows(metricsRes, "metrics");
  const rounds = rows(roundsRes, "rounds");
  const latest = new Map<string, (typeof metrics)[number]>();
  for (const m of metrics) if (!latest.has(m.metric_key)) latest.set(m.metric_key, m);
  const round = rounds[0];

  return (
    <>
      <PageHeader title={f.companyTitle} description={f.companySub} />
      <div className="space-y-6">
        <Card>
          <CardHeader title={f.companyProfile} />
          <CardBody>
            <StartupProfileForm s={startup} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={f.traction} description={f.tractionSub} />
          {latest.size === 0 ? (
            <EmptyState title={f.noMetrics} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t.startups.colMetric}</Th>
                  <Th>{t.common.value}</Th>
                  <Th>{t.common.period}</Th>
                  <Th>{t.common.source}</Th>
                  <Th>{t.common.status}</Th>
                </tr>
              </thead>
              <tbody>
                {[...latest.values()].map((m) => (
                  <tr key={m.id}>
                    <Td className="font-medium">{isMetricKey(m.metric_key) ? t.enums.metric[m.metric_key] : m.metric_key}</Td>
                    <Td className="tabular">{metricValue(Number(m.value), m.unit)}</Td>
                    <Td>{m.period}</Td>
                    <Td className="text-xs text-ink-2">
                      {m.source}
                      <div className="text-muted">{date(m.created_at, locale)}</div>
                    </Td>
                    <Td>
                      <Badge tone={VERIFICATION_TONE[m.verification]}>{t.enums.verification_status[m.verification]}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <CardBody className="border-t border-line">
            <AddMetricForm startupId={startup.id} staff={false} />
          </CardBody>
        </Card>

        <Card id="fundraising">
          <CardHeader
            title={t.startups.fundraising}
            description={round ? fmt(f.fundraisingSaved, { date: date(round.created_at, locale), n: rounds.length }) : f.fundraisingSub}
            actions={round && <Badge tone={VERIFICATION_TONE[round.verification]}>{t.enums.verification_status[round.verification]}</Badge>}
          />
          <CardBody>
            <FundraisingForm startupId={startup.id} staff={false} current={round} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={f.team} />
          <ul className="divide-y divide-line">
            {founders.length === 0 && <li className="px-5 py-3 text-sm text-muted">{f.addTeam}</li>}
            {founders.map((p) => (
              <li key={p.id} className="px-5 py-3 text-sm">
                <span className="font-medium">{p.full_name}</span> <span className="text-muted">· {p.role}</span>
                {p.linkedin && (
                  <a href={p.linkedin} target="_blank" rel="noreferrer noopener" className="ml-2 text-xs text-brand-600">
                    {t.common.linkedin}
                  </a>
                )}
                {p.bio && <p className="text-xs text-ink-2">{p.bio}</p>}
              </li>
            ))}
          </ul>
          <CardBody className="border-t border-line">
            <ActionForm action={addFounder} resetOnSuccess className="grid gap-2 sm:grid-cols-4">
              <input type="hidden" name="startup_id" value={startup.id} />
              <Input name="full_name" placeholder={t.common.fullName} required aria-label={t.common.fullName} />
              <Input name="role" placeholder={f.rolePh} aria-label={f.rolePh} />
              <Input name="linkedin" type="url" placeholder={t.investors.linkedinUrl} aria-label={t.investors.linkedinUrl} />
              <SubmitButton variant="secondary">{f.addPerson}</SubmitButton>
              <Input name="bio" placeholder={f.bioPh} className="sm:col-span-4" aria-label={f.bioPh} />
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
