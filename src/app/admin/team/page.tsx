import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardBody, CardHeader, Field, Input, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { inviteUser, setMemberActive, updateKpiTarget } from "@/lib/actions/team";
import { getStaff } from "@/lib/data";
import { isKeyOf } from "@/lib/labels";
import { date } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { AccessGrantsCard, AccessRequestsCard } from "@/components/access-admin";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.team };
}

const YV_ORG_ID = "00000000-0000-4000-8000-000000000001";

export default async function TeamPage() {
  const me = await requireUser(["yv_admin"]);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const x = t.team;
  const [membersRes, targetsRes, staff, requestsRes, grantsRes, orgsRes] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, is_active, is_org_admin, created_at, user_id, organizations(name, type), user_profiles(full_name, email, user_type)")
      .order("created_at", { ascending: false }),
    supabase.from("program_kpi_targets").select("*").order("sort_order"),
    getStaff(supabase),
    supabase.from("access_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("access_grants").select("*, organizations(name)").order("created_at", { ascending: false }).limit(50),
    supabase.from("organizations").select("id, name, type, is_demo").is("deleted_at", null).order("name"),
  ]);
  const orgs = rows(orgsRes, "organizations");
  const invitesConnected = !!process.env.SUPABASE_SECRET_KEY;

  return (
    <>
      <PageHeader title={x.title} description={x.subtitle} />

      <div className="mb-6">
        <AccessRequestsCard requests={rows(requestsRes, "access requests")} orgs={orgs} t={t} locale={locale} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={x.members} />
          <Table>
            <thead>
              <tr>
                <Th>{x.colPerson}</Th>
                <Th>{x.colOrg}</Th>
                <Th>{x.colRole}</Th>
                <Th>{x.colSince}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows(membersRes, "members").map((m) => {
                const u = m.user_profiles;
                return (
                  <tr key={m.id}>
                    <Td>
                      <p className="font-medium">{u.full_name}</p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </Td>
                    <Td className="text-ink-2">{m.organizations.name}</Td>
                    <Td>
                      <Badge tone={u.user_type === "yv_admin" ? "dark" : "neutral"}>{t.roles[u.user_type]}</Badge>
                      {m.is_org_admin && u.user_type !== "yv_admin" && <Badge className="ml-1">{t.investors.orgAdmin}</Badge>}
                      {!m.is_active && (
                        <Badge tone="neg" className="ml-1">
                          {t.investors.removed}
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-ink-2">{date(m.created_at, locale)}</Td>
                    <Td className="text-right">
                      {m.user_id !== me.id && (
                        <ActionForm action={setMemberActive} confirm={m.is_active ? x.removeConfirm : undefined}>
                          <input type="hidden" name="member_id" value={m.id} />
                          <input type="hidden" name="active" value={String(!m.is_active)} />
                          <SubmitButton size="sm" variant={m.is_active ? "danger" : "secondary"}>
                            {m.is_active ? t.common.remove : t.common.restore}
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          <AccessGrantsCard grants={rows(grantsRes, "access grants")} orgs={orgs} t={t} locale={locale} />
          <Card>
            <CardHeader title={x.inviteStaff} description={x.inviteStaffSub} />
            <CardBody>
              {!invitesConnected && <p className="mb-3 rounded-md bg-warn-50 px-3 py-2 text-xs text-warn">{x.notConnected}</p>}
              <ActionForm action={inviteUser} resetOnSuccess className="space-y-3">
                <input type="hidden" name="org_id" value={YV_ORG_ID} />
                <Field label={t.common.fullName}>
                  <Input name="full_name" required />
                </Field>
                <Field label={t.common.email}>
                  <Input name="email" type="email" required />
                </Field>
                <Field label={x.role}>
                  <Select name="user_type" defaultValue="yv_team">
                    <option value="yv_team">{x.roleTeam}</option>
                    <option value="yv_admin">{x.roleAdmin}</option>
                  </Select>
                </Field>
                <SubmitButton className="w-full">{t.common.send}</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={x.targets} description={x.targetsSub} />
            <ul className="divide-y divide-line">
              {rows(targetsRes, "targets").map((k) => (
                <li key={k.key} className="px-5 py-3">
                  <p className="text-sm">{isKeyOf(t.kpi, k.key) ? t.kpi[k.key].label : k.label}</p>
                  <ActionForm action={updateKpiTarget} className="mt-1 flex items-center gap-2">
                    <input type="hidden" name="key" value={k.key} />
                    <Input name="target" type="number" min={0} defaultValue={k.target} className="h-8 w-20 text-sm" aria-label={x.target} />
                    <Select name="owner_id" defaultValue={k.owner_id ?? ""} className="h-8 text-xs" aria-label={x.responsible}>
                      <option value="">{x.noOwner}</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || s.email}
                        </option>
                      ))}
                    </Select>
                    <SubmitButton size="sm" variant="secondary">
                      {t.common.save}
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
