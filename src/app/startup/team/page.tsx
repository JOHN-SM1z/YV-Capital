import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardBody, CardHeader, Input, PageHeader } from "@/components/ui";
import { inviteUser, setMemberActive } from "@/lib/actions/team";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.teamAccess };
}

export default async function FounderTeam() {
  const me = await requireUser(["founder"]);
  const supabase = await createClient();
  const { t } = await getI18n();
  const f = t.founderPortal;
  const members = rows(await supabase.from("organization_members").select("id, is_active, is_org_admin, user_id, user_profiles(full_name, email)"), "members");
  return (
    <>
      <PageHeader title={f.teamTitle} description={f.teamSub} />
      <Card className="max-w-2xl">
        <CardHeader title={f.members} />
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <p>
                  {m.user_profiles.full_name} {m.is_org_admin && <Badge>{t.investorPortal.admin}</Badge>}{" "}
                  {!m.is_active && <Badge tone="neg">{t.investors.removed}</Badge>}
                </p>
                <p className="text-xs text-muted">{m.user_profiles.email}</p>
              </div>
              {me.isOrgAdmin && m.user_id !== me.id && (
                <ActionForm action={setMemberActive} confirm={m.is_active ? t.investorPortal.removeTeammate : undefined}>
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
        {me.isOrgAdmin ? (
          <CardBody className="border-t border-line">
            <ActionForm action={inviteUser} resetOnSuccess className="flex flex-wrap gap-2">
              <Input name="full_name" placeholder={t.common.fullName} required className="max-w-48" aria-label={t.common.fullName} />
              <Input name="email" type="email" placeholder={t.common.email} required className="max-w-60" aria-label={t.common.email} />
              <SubmitButton variant="secondary">{f.invite}</SubmitButton>
            </ActionForm>
          </CardBody>
        ) : (
          <p className="border-t border-line px-5 py-3 text-xs text-muted">{f.askAdmin}</p>
        )}
      </Card>
    </>
  );
}
