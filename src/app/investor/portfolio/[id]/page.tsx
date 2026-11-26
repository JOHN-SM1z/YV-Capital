import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getPortfolio } from "@/lib/portfolio";
import { getPublicRecords } from "@/lib/data";
import { getFollowedIds, getRounds } from "@/lib/funding";
import { FundingCard } from "@/components/funding-card";
import { FollowButton } from "@/components/follow-button";
import { requestMeeting } from "@/lib/actions/portal";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CompanyLogo } from "@/components/company-logo";
import { PublicRecordsList } from "@/components/public-records";
import { Card, CardBody, CardHeader, Field, Input, KeyValue, PageHeader } from "@/components/ui";
import { isRoundType } from "@/lib/labels";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.investorPortal.recordsTitle };
}

export default async function PortfolioCompanyPage({ params }: PageProps<"/investor/portfolio/[id]">) {
  const { id } = await params;
  const user = await requireUser(["investor"]);
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { t } = await getI18n();
  const p = t.investorPortal;
  // The directory only contains portfolio companies, so anything else is a 404.
  const company = (await getPortfolio(supabase)).find((c) => c.id === id);
  if (!company) notFound();
  const [records, rounds, followed] = await Promise.all([getPublicRecords(supabase, id), getRounds(supabase, id), getFollowedIds(supabase, user.id)]);
  const stage = company.funding_stage && isRoundType(company.funding_stage) ? t.enums.funding_stage[company.funding_stage] : null;

  return (
    <>
      <PageHeader
        back={{ href: "/investor/portfolio", label: t.nav.portfolio }}
        title={
          <span className="flex items-center gap-3">
            <CompanyLogo name={company.name} url={company.logo_url} size={48} />
            {company.name}
          </span>
        }
        description={company.one_liner}
        actions={<FollowButton startupId={company.id} name={company.name} following={followed.has(company.id)} t={t} size="md" />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FundingCard rounds={rounds} />
          <Card>
            <CardHeader title={`${p.recordsTitle} · ${records.length}`} description={fmt(p.recordsSub, { name: company.name })} />
            <PublicRecordsList records={records} emptyBody={p.noRecordsYet} />
            {records.length === 1 && <p className="border-t border-line px-5 py-3 text-sm text-muted">{p.noRecordsYet}</p>}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title={p.overview} />
            <CardBody>
              <KeyValue
                items={[
                  [t.common.sector, company.sector],
                  [t.common.stage, stage],
                  [t.common.country, company.country],
                  [t.startups.founded, company.founded_year],
                  [
                    t.common.website,
                    company.website && (
                      <a href={company.website} target="_blank" rel="noreferrer noopener" className="text-brand-600 hover:underline">
                        {t.common.websiteLink}
                      </a>
                    ),
                  ],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={p.requestMeeting} description={p.interestedCta} />
            <CardBody>
              <ActionForm action={requestMeeting} resetOnSuccess className="space-y-3">
                <Field label={p.topic}>
                  <Input name="topic" defaultValue={fmt(p.topicDefault, { name: company.name })} required />
                </Field>
                <Field label={p.availability}>
                  <Input name="availability" placeholder={p.availabilityPh} />
                </Field>
                <SubmitButton className="w-full">{p.requestMeeting}</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
