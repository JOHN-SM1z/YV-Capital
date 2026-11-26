import { ActionForm, SubmitButton } from "@/components/action-form";
import { PreferenceFields } from "@/components/preference-fields";
import { Card, CardBody, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createInvestor } from "@/lib/actions/investors";
import { requireUser, STAFF } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { Constants } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.investors.newTitle };
}

export default async function NewInvestorPage() {
  await requireUser(STAFF);
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.investors.newTitle} back={{ href: "/admin/investors", label: t.nav.investors }} description={t.investors.newSub} />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={createInvestor} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.investors.orgName}>
                <Input name="name" required />
              </Field>
              <Field label={t.investors.type}>
                <Select name="category" defaultValue="vc_fund">
                  {Constants.public.Enums.investor_category.map((c) => (
                    <option key={c} value={c}>
                      {t.enums.investor_category[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.common.website}>
                <Input name="website" type="url" placeholder="https://" />
              </Field>
              <Field label={t.common.country}>
                <Input name="country" />
              </Field>
              <Field label={t.common.city}>
                <Input name="headquarters" />
              </Field>
            </div>
            <Field label={t.investors.thesis}>
              <Textarea name="thesis" />
            </Field>
            <PreferenceFields showCoInvest={false} />
            <SubmitButton>{t.investors.add}</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
