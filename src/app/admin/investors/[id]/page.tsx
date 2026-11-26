import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getInvestorsForMatch, getStaff, getStartupsForMatch } from "@/lib/data";
import { rankStartups } from "@/lib/matching/score";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PreferenceFields } from "@/components/preference-fields";
import { MatchRow } from "@/components/match-list";
import { NotesCard } from "@/components/notes-card";
import { FollowUpsCard } from "@/components/follow-ups-card";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { addContact, updateInvestorProfile, updatePreferences, updateRelationship } from "@/lib/actions/investors";
import { inviteUser, setMemberActive } from "@/lib/actions/team";
import { EVIDENCE_TONE, INTEREST_TONE, MEETING_TONE, OPPORTUNITY_TONE, RELATIONSHIP_TONE, isEvidenceType } from "@/lib/labels";
import { date, dateTime } from "@/lib/format";
import { maybeRow, rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { Constants } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.investors.title };
}

export default async function InvestorDetail({ params }: PageProps<"/admin/investors/[id]">) {
  const { id } = await params;
  const me = await requireUser(STAFF);
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { t, locale } = await getI18n();

  const inv = maybeRow(
    await supabase.from("investors").select("*, organizations(*), investor_preferences(*), investor_relationships(*)").eq("id", id).maybeSingle(),
    "investor",
  );
  if (!inv) notFound();
  const org = inv.organizations;
  const prefs = inv.investor_preferences;
  const rel = inv.investor_relationships;

  const [staff, contactsRes, accessRes, interestsRes, meetingsRes, membersRes, investors, startups] = await Promise.all([
    getStaff(supabase),
    supabase.from("investor_contacts").select("*").eq("investor_id", id).order("is_primary", { ascending: false }),
    supabase.from("opportunity_access").select("granted_at, investment_opportunities(id, title, status)").eq("investor_org_id", org.id),
    supabase.from("investor_interests").select("opportunity_id, level, indicative_amount").eq("investor_org_id", org.id),
    supabase.from("meetings").select("id, title, starts_at, status").eq("investor_org_id", org.id).order("starts_at", { ascending: false }).limit(10),
    supabase.from("organization_members").select("id, is_active, is_org_admin, user_profiles(full_name, email)").eq("org_id", org.id),
    getInvestorsForMatch(supabase),
    getStartupsForMatch(supabase),
  ]);
  const contacts = rows(contactsRes, "contacts");
  const access = rows(accessRes, "access");
  const interestBy = new Map(rows(interestsRes, "interests").map((i) => [i.opportunity_id, i]));
  const meetings = rows(meetingsRes, "meetings");
  const members = rows(membersRes, "members");

  const forMatch = investors.find((i) => i.id === id);
  const matches = forMatch
    ? rankStartups(forMatch, startups)
        .filter((m) => m.fit !== "none")
        .slice(0, 6)
    : [];
  const evidence = isEvidenceType(inv.evidence_type) ? inv.evidence_type : null;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/investors", label: t.nav.investors }}
        title={<span className="flex flex-wrap items-center gap-2">{org.name}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {[t.enums.investor_category[inv.category], inv.headquarters, org.country].filter(Boolean).join(" · ")}
            {org.website && (
              <a href={org.website} target="_blank" rel="noreferrer noopener" className="text-brand-600 hover:underline">
                {t.common.websiteLink}
              </a>
            )}
            {rel && <Badge tone={RELATIONSHIP_TONE[rel.status]}>{t.enums.relationship_status[rel.status]}</Badge>}
          </span>
        }
        actions={
          <Link href={`/admin/matching?investor=${id}`} className="text-sm font-medium text-brand-600">
            {t.investors.openInMatching}
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {evidence && (
            <Card>
              <CardHeader title={t.investors.evidence} actions={<Badge tone={EVIDENCE_TONE[evidence]}>{t.enums.evidence_type[evidence]}</Badge>} />
              <CardBody className="space-y-2">
                <p className="text-sm">{inv.evidence_summary}</p>
                <p className="text-xs text-warn">{t.investors.inferred}</p>
                {inv.uzbek_companies.length > 0 && (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {t.investors.uzbekCompanies}:{" "}
                    {inv.uzbek_companies.map((c) => (
                      <Badge key={c}>{c}</Badge>
                    ))}
                  </p>
                )}
                {inv.evidence_url && (
                  <a href={inv.evidence_url} target="_blank" rel="noreferrer noopener" className="text-sm font-medium text-brand-600 hover:underline">
                    {t.investors.evidenceSource} ↗{inv.evidence_date ? ` · ${date(inv.evidence_date, locale)}` : ""}
                  </a>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title={t.investors.bestFit} description={t.investors.bestFitSub} />
            {matches.length ? (
              <ul className="divide-y divide-line">
                {matches.map((m) => (
                  <MatchRow key={m.startupId} href={`/admin/startups/${m.startupId}`} name={m.startupName} result={m} />
                ))}
              </ul>
            ) : (
              <EmptyState title={t.investors.noFit}>{t.investors.noFitBody}</EmptyState>
            )}
          </Card>

          <Card>
            <CardHeader title={t.investors.shared} />
            {access.length === 0 ? (
              <EmptyState title={t.investors.nothingShared} />
            ) : (
              <ul className="divide-y divide-line">
                {access.map((a) => {
                  const o = a.investment_opportunities;
                  const interest = interestBy.get(o.id);
                  return (
                    <li key={o.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                      <Link href={`/admin/opportunities/${o.id}`} className="font-medium hover:underline">
                        {o.title}
                      </Link>
                      <Badge tone={OPPORTUNITY_TONE[o.status]}>{t.enums.opportunity_status[o.status]}</Badge>
                      {interest ? (
                        <Badge tone={INTEREST_TONE[interest.level]}>{t.enums.interest_level[interest.level]}</Badge>
                      ) : (
                        <span className="text-xs text-muted">{t.investors.noResponse}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t.investors.prefs} description={t.investors.prefsSub} />
            <CardBody>
              <ActionForm action={updatePreferences} className="space-y-4">
                <input type="hidden" name="investor_id" value={id} />
                <PreferenceFields p={prefs ?? {}} />
                <SubmitButton>{t.investors.savePrefs}</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t.investors.profile} />
            <CardBody>
              <ActionForm action={updateInvestorProfile} className="space-y-3">
                <input type="hidden" name="investor_id" value={id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t.investors.orgName}>
                    <Input name="name" defaultValue={org.name} />
                  </Field>
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
                <Field label={t.investors.description}>
                  <Textarea name="description" defaultValue={inv.description ?? ""} />
                </Field>
                <Field label={t.investors.portfolio}>
                  <Textarea name="portfolio_highlights" defaultValue={inv.portfolio_highlights ?? ""} />
                </Field>
                <SubmitButton variant="secondary">{t.investors.saveProfile}</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <NotesCard entityType="investor" entityId={id} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t.investors.relationship} description={t.common.internalOnly} />
            <CardBody>
              <ActionForm action={updateRelationship} className="space-y-3">
                <input type="hidden" name="investor_id" value={id} />
                <Field label={t.common.status}>
                  <Select name="status" defaultValue={rel?.status ?? "identified"}>
                    {Constants.public.Enums.relationship_status.map((s) => (
                      <option key={s} value={s}>
                        {t.enums.relationship_status[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t.common.priority}>
                  <Select name="priority" defaultValue={rel?.priority ?? "medium"}>
                    <option value="high">{t.investors.priorityHigh}</option>
                    <option value="medium">{t.common.medium}</option>
                    <option value="low">{t.common.low}</option>
                  </Select>
                </Field>
                <Field label={t.investors.relOwner}>
                  <Select name="owner_id" defaultValue={rel?.owner_id ?? ""}>
                    <option value="">{t.common.unassigned}</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t.investors.lastContact}>
                    <Input type="date" name="last_contact_at" defaultValue={rel?.last_contact_at ?? ""} />
                  </Field>
                  <Field label={t.investors.nextFollowUp}>
                    <Input type="date" name="next_follow_up_at" defaultValue={rel?.next_follow_up_at ?? ""} />
                  </Field>
                </div>
                <Field label={t.investors.tags} hint={t.investors.tagsHint}>
                  <Input name="tags" defaultValue={rel?.tags.join(", ") ?? ""} />
                </Field>
                <SubmitButton className="w-full">{t.common.save}</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <FollowUpsCard investorId={id} />

          <Card>
            <CardHeader title={t.investors.contacts} />
            <ul className="divide-y divide-line">
              {contacts.map((c) => (
                <li key={c.id} className="px-5 py-3 text-sm">
                  <p className="font-medium">
                    {c.full_name} {c.is_primary && <Badge>{t.investors.primary}</Badge>}
                  </p>
                  <p className="text-xs text-muted">{c.title}</p>
                  {c.email && (
                    <a className="text-xs text-brand-600" href={`mailto:${c.email}`}>
                      {c.email}
                    </a>
                  )}
                  {c.linkedin && (
                    <a className="ml-2 text-xs text-brand-600" href={c.linkedin} target="_blank" rel="noreferrer noopener">
                      {t.common.linkedin}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <CardBody className="border-t border-line">
              <ActionForm action={addContact} resetOnSuccess className="space-y-2">
                <input type="hidden" name="investor_id" value={id} />
                <Input name="full_name" placeholder={t.common.fullName} required aria-label={t.common.fullName} />
                <Input name="title" placeholder={t.investors.jobTitle} aria-label={t.investors.jobTitle} />
                <Input name="email" type="email" placeholder={t.investors.workEmail} aria-label={t.investors.workEmail} />
                <Input name="linkedin" type="url" placeholder={t.investors.linkedinUrl} aria-label={t.investors.linkedinUrl} />
                <SubmitButton variant="secondary" size="sm">
                  {t.investors.addContact}
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t.investors.meetings} />
            <ul className="divide-y divide-line">
              {meetings.length === 0 && <li className="px-5 py-3 text-sm text-muted">{t.investors.noMeetings}</li>}
              {meetings.map((m) => (
                <li key={m.id} className="px-5 py-3 text-sm">
                  <p>{m.title}</p>
                  <p className="text-xs text-muted">
                    {dateTime(m.starts_at, locale)} <Badge tone={MEETING_TONE[m.status]}>{t.enums.meeting_status[m.status]}</Badge>
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t.investors.portalAccess} description={t.investors.portalAccessSub} />
            <ul className="divide-y divide-line">
              {members.length === 0 && <li className="px-5 py-3 text-sm text-muted">{t.investors.noOneInvited}</li>}
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      {m.user_profiles.full_name} {m.is_org_admin && <Badge>{t.investors.orgAdmin}</Badge>}{" "}
                      {!m.is_active && <Badge tone="neg">{t.investors.removed}</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">{m.user_profiles.email}</p>
                  </div>
                  {me.userType === "yv_admin" && (
                    <ActionForm action={setMemberActive} confirm={m.is_active ? t.investors.removeConfirm : undefined}>
                      <input type="hidden" name="member_id" value={m.id} />
                      <input type="hidden" name="active" value={String(!m.is_active)} />
                      <SubmitButton variant={m.is_active ? "danger" : "secondary"} size="sm">
                        {m.is_active ? t.common.remove : t.common.restore}
                      </SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
            {me.userType === "yv_admin" && (
              <CardBody className="border-t border-line">
                <ActionForm action={inviteUser} resetOnSuccess className="space-y-2">
                  <input type="hidden" name="org_id" value={org.id} />
                  <input type="hidden" name="user_type" value="investor" />
                  <Input name="full_name" placeholder={t.common.fullName} required aria-label={t.common.fullName} />
                  <Input name="email" type="email" placeholder={t.common.email} required aria-label={t.common.email} />
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="is_org_admin" className="accent-brand" /> {t.investors.orgAdminHint}
                  </label>
                  <SubmitButton variant="secondary" size="sm">
                    {t.common.send}
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
