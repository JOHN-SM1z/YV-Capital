import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PreferenceFields } from "@/components/preference-fields";
import { Badge, Card, CardBody, CardHeader, Field, Input, KeyValue, PageHeader, Select, Textarea } from "@/components/ui";
import { updateInvestorProfile, updatePreferences } from "@/lib/actions/investors";
import { inviteUser, setMemberActive } from "@/lib/actions/team";
import { isRoundType } from "@/lib/labels";
import { usdRange } from "@/lib/format";
import { maybeRow, rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { Constants } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.organization };
}

export default async function InvestorOrganization() {
  const me = await requireUser(["investor"]);
  const supabase = await createClient();
  const { t } = await getI18n();
  const p = t.investorPortal;
  const [invRes, membersRes] = await Promise.all([
    supabase.from("investors").select("*, organizations(name, website, country), investor_preferences(*)").maybeSingle(),
    supabase.from("organization_members").select("id, is_active, is_org_admin, user_id, user_profiles(full_name, email)"),
  ]);
  const inv = maybeRow(invRes, "my investor profile");
  if (!inv) return <PageHeader title={t.nav.organization} description={p.orgSettingUp} />;
  const org = inv.organizations;
  const prefs = inv.investor_preferences;
  const canEdit = me.isOrgAdmin;
  const stages = prefs?.stages.map((s) => (isRoundType(s) ? t.enums.funding_stage[s] : s)).join(", ");

  return (
    <>
      <PageHeader title={org.name} description={canEdit ? p.orgEditable : p.orgReadOnly} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t.investors.prefs} />
            <CardBody>
              {canEdit ? (
                <ActionForm action={updatePreferences} className="space-y-4">
                  <input type="hidden" name="investor_id" value={inv.id} />
                  <PreferenceFields p={prefs ?? {}} />
                  <SubmitButton>{t.investors.savePrefs}</SubmitButton>
                </ActionForm>
              ) : (
                <KeyValue
                  items={[
                    [t.common.sector, prefs?.sectors.join(", ") || t.investors.sectorAgnostic],
                    [t.prefs.stages, stages],
                    [t.prefs.geographies, prefs?.geographies.join(", ")],
                    [t.investors.colCheck, usdRange(prefs?.min_check, prefs?.max_check)],
                  ]}
                />
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={p.orgProfile} />
            <CardBody>
              {canEdit ? (
                <ActionForm action={updateInvestorProfile} className="space-y-3">
                  <input type="hidden" name="investor_id" value={inv.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t.investors.type}>
                      <Select name="category" defaultValue={inv.category}>
                        {Constants.public.Enums.investor_category.map((c) => (
                          <option key={c} value={c}>
                            {t.enums.investor_category[c]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t.common.website}>
                      <Input name="website" type="url" defaultValue={org.website ?? ""} />
                    </Field>
                    <Field label={t.common.country}>
                      <Input name="country" defaultValue={org.country ?? ""} />
                    </Field>
                    <Field label={t.common.headquarters}>
                      <Input name="headquarters" defaultValue={inv.headquarters ?? ""} />
                    </Field>
                  </div>
                  <Field label={t.investors.thesis}>
                    <Textarea name="thesis" defaultValue={inv.thesis ?? ""} />
                  </Field>
                  <Field label={p.about}>
                    <Textarea name="description" defaultValue={inv.description ?? ""} />
                  </Field>
                  <SubmitButton variant="secondary">{t.investors.saveProfile}</SubmitButton>
                </ActionForm>
              ) : (
                <KeyValue
                  items={[
                    [t.investors.type, t.enums.investor_category[inv.category]],
                    [t.common.headquarters, inv.headquarters],
                    [t.common.website, org.website],
                    [t.investors.thesis, inv.thesis],
                  ]}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader title={p.teamMembers} description={p.teamMembersSub} />
          <ul className="divide-y divide-line">
            {rows(membersRes, "members").map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    {m.user_profiles.full_name} {m.is_org_admin && <Badge>{p.admin}</Badge>} {!m.is_active && <Badge tone="neg">{t.investors.removed}</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.user_profiles.email}</p>
                </div>
                {canEdit && m.user_id !== me.id && (
                  <ActionForm action={setMemberActive} confirm={m.is_active ? p.removeTeammate : undefined}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="active" value={String(!m.is_active)} />
                    <SubmitButton size="sm" variant={m.is_active ? "danger" : "secondary"}>
                      {m.is_active ? t.common.remove : t.common.restore}
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <CardBody className="border-t border-line">
              <ActionForm action={inviteUser} resetOnSuccess className="space-y-2">
                <Input name="full_name" placeholder={t.common.fullName} required aria-label={t.common.fullName} />
                <Input name="email" type="email" placeholder={p.workEmail} required aria-label={p.workEmail} />
                <SubmitButton size="sm" variant="secondary">
                  {p.inviteTeammate}
                </SubmitButton>
              </ActionForm>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
