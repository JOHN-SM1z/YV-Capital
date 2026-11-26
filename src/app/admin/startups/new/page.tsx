import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, CardBody, Field, Input, PageHeader, Select } from "@/components/ui";
import { createStartup } from "@/lib/actions/startups";
import { requireUser, STAFF } from "@/lib/auth";
import { FUNDING_STAGES, SECTORS } from "@/lib/labels";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.startups.add };
}

export default async function NewStartupPage() {
  await requireUser(STAFF);
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.startups.newTitle} back={{ href: "/admin/startups", label: t.nav.startups }} description={t.startups.newSub} />
      <Card className="max-w-2xl">
        <CardBody>
          <ActionForm action={createStartup} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.startups.colCompany}>
                <Input name="name" required />
              </Field>
              <Field label={t.common.website}>
                <Input name="website" type="url" placeholder="https://" />
              </Field>
              <Field label={t.common.sector}>
                <Select name="sector" defaultValue="">
                  <option value="">{t.common.choose}</option>
                  {SECTORS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t.startups.fundingStage}>
                <Select name="funding_stage" defaultValue="">
                  <option value="">{t.common.unknown}</option>
                  {FUNDING_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {t.enums.funding_stage[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.common.country}>
                <Input name="country" defaultValue="Uzbekistan" />
              </Field>
            </div>
            <Field label={t.startups.oneLiner}>
              <Input name="one_liner" maxLength={200} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_portfolio" className="size-4 accent-brand" /> {t.startups.portfolioCheck}
            </label>
            <SubmitButton>{t.startups.add}</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
