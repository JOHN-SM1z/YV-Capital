import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, Table, Td, Th } from "@/components/ui";
import { addAccessGrant, approveAccessRequest, declineAccessRequest, revokeAccessGrant } from "@/lib/actions/access";
import { isKeyOf } from "@/lib/labels";
import { date, dateTime } from "@/lib/format";
import { fmt, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import type { Database } from "@/lib/database.types";

type Org = { id: string; name: string; type: Database["public"]["Enums"]["org_type"]; is_demo: boolean };
type Request = Database["public"]["Tables"]["access_requests"]["Row"];
type Grant = Database["public"]["Tables"]["access_grants"]["Row"] & { organizations: { name: string } | null };

const ROLE_FOR_REQUEST = { investor: "investor", founder: "founder", yv: "yv_team" } as const;

/** Organizations grouped by type, for "which organization" selects. */
function OrgOptions({ orgs, t }: { orgs: Org[]; t: Dictionary }) {
  const groups = [
    ["yv", t.roles.yv_team],
    ["investor", t.roles.investor],
    ["startup", t.roles.founder],
  ] as const;
  return (
    <>
      {groups.map(([type, label]) => (
        <optgroup key={type} label={label}>
          {orgs
            .filter((o) => o.type === type)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.is_demo ? ` (${t.common.sandbox})` : ""}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

function RoleOptions({ t }: { t: Dictionary }) {
  return (
    <>
      <option value="investor">{t.roles.investor}</option>
      <option value="founder">{t.roles.founder}</option>
      <option value="yv_team">{t.roles.yv_team}</option>
      <option value="yv_admin">{t.roles.yv_admin}</option>
    </>
  );
}

/** Pending sign-ups awaiting a YV admin's decision. */
export function AccessRequestsCard({ requests, orgs, t, locale }: { requests: Request[]; orgs: Org[]; t: Dictionary; locale: Locale }) {
  const a = t.access;
  return (
    <Card id="requests">
      <CardHeader title={`${a.requestsTitle} · ${requests.length}`} description={a.requestsSub} />
      {requests.length === 0 ? (
        <EmptyState title={a.noRequests} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{a.colApplicant}</Th>
              <Th>{a.colRequested}</Th>
              <Th>{a.approveAs}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const role = r.requested_role && isKeyOf(ROLE_FOR_REQUEST, r.requested_role) ? ROLE_FOR_REQUEST[r.requested_role] : "investor";
              return (
                <tr key={r.user_id}>
                  <Td>
                    <p className="font-medium">{r.full_name || "—"}</p>
                    <p className="text-xs text-muted">{r.email}</p>
                    <p className="mt-1 text-xs text-muted">
                      {a.colVia}: {r.provider && isKeyOf(a.provider, r.provider) ? a.provider[r.provider] : (r.provider ?? "—")} ·{" "}
                      {dateTime(r.created_at, locale)}
                    </p>
                  </Td>
                  <Td className="max-w-72">
                    {r.requested_role && isKeyOf(a.requestedRole, r.requested_role) && <Badge>{a.requestedRole[r.requested_role]}</Badge>}
                    {r.organization_name && <p className="mt-1 text-sm">{r.organization_name}</p>}
                    {r.message && <p className="mt-1 text-xs text-ink-2">{r.message}</p>}
                  </Td>
                  <Td className="min-w-64">
                    <ActionForm action={approveAccessRequest} className="space-y-2">
                      <input type="hidden" name="user_id" value={r.user_id} />
                      <Select name="user_type" defaultValue={role} className="h-9 text-sm" aria-label={a.approveAs}>
                        <RoleOptions t={t} />
                      </Select>
                      <Select name="org_id" required defaultValue="" className="h-9 text-sm" aria-label={a.inOrganization}>
                        <option value="" disabled>
                          {a.inOrganization}…
                        </option>
                        <OrgOptions orgs={orgs} t={t} />
                      </Select>
                      <label className="flex items-center gap-2 text-xs text-ink-2">
                        <input type="checkbox" name="is_org_admin" className="size-4 accent-brand" /> {a.orgAdmin}
                      </label>
                      <SubmitButton size="sm" className="w-full">
                        {a.approve}
                      </SubmitButton>
                    </ActionForm>
                  </Td>
                  <Td className="text-right">
                    <ActionForm action={declineAccessRequest} confirm={a.declineConfirm}>
                      <input type="hidden" name="user_id" value={r.user_id} />
                      <SubmitButton size="sm" variant="danger">
                        {a.decline}
                      </SubmitButton>
                    </ActionForm>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <p className="border-t border-line px-5 py-3 text-xs text-muted">{a.addOrgFirst}</p>
    </Card>
  );
}

/** Emails that get a role automatically once someone signs up with them and verifies the address. */
export function AccessGrantsCard({ grants, orgs, t, locale }: { grants: Grant[]; orgs: Org[]; t: Dictionary; locale: Locale }) {
  const a = t.access;
  return (
    <Card>
      <CardHeader title={a.grantsTitle} description={a.grantsSub} />
      {grants.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">{a.noGrants}</p>
      ) : (
        <ul className="divide-y divide-line">
          {grants.map((g) => (
            <li key={g.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.email}</p>
                <p className="text-xs text-muted">
                  {t.roles[g.user_type]} · {g.organizations?.name ?? "—"}
                  {g.is_org_admin && g.user_type !== "yv_admin" ? ` · ${a.orgAdmin}` : ""}
                </p>
                <p className="text-xs text-muted">{g.used_at ? fmt(a.grantUsed, { date: date(g.used_at, locale) }) : a.grantOpen}</p>
              </div>
              {!g.used_at && (
                <ActionForm action={revokeAccessGrant}>
                  <input type="hidden" name="id" value={g.id} />
                  <SubmitButton size="sm" variant="ghost" pendingLabel="…">
                    {a.revoke}
                  </SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
      <CardBody className="border-t border-line">
        <ActionForm action={addAccessGrant} resetOnSuccess className="space-y-3">
          <Field label={t.common.email}>
            <Input name="email" type="email" required />
          </Field>
          <Field label={t.common.fullName}>
            <Input name="full_name" maxLength={200} />
          </Field>
          <Field label={a.approveAs}>
            <Select name="user_type" defaultValue="investor">
              <RoleOptions t={t} />
            </Select>
          </Field>
          <Field label={a.inOrganization}>
            <Select name="org_id" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              <OrgOptions orgs={orgs} t={t} />
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" name="is_org_admin" className="size-4 accent-brand" /> {a.orgAdmin}
          </label>
          <SubmitButton variant="secondary" className="w-full">
            {a.grantAdd}
          </SubmitButton>
        </ActionForm>
      </CardBody>
    </Card>
  );
}
