import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { ActionForm, SubmitButton, ToggleCheck } from "@/components/action-form";
import { MeetingItem } from "@/components/meeting-item";
import { Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createFollowUp, createMeeting, toggleFollowUp } from "@/lib/actions/meetings";
import { date, todayTashkent } from "@/lib/format";
import { getStaff } from "@/lib/data";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.meetings };
}

export default async function MeetingsPage() {
  await requireUser(STAFF);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const x = t.meetings;
  const nowIso = new Date().toISOString();
  const today = todayTashkent();
  const [meetingsRes, orgsRes, startupsRes, followUpsRes, staff] = await Promise.all([
    supabase
      .from("meetings")
      .select("*, organizations(name), startups(name), meeting_notes(notes, outcome)")
      .order("starts_at", { ascending: false, nullsFirst: true })
      .limit(100),
    supabase.from("organizations").select("id, name").eq("type", "investor").order("name"),
    supabase.from("startups").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("follow_ups")
      .select("id, title, due_date, priority, is_done, investor_id, startup_id, user_profiles!follow_ups_assigned_to_fkey(full_name)")
      .eq("is_done", false)
      .order("due_date", { nullsFirst: false }),
    getStaff(supabase),
  ]);
  const meetings = rows(meetingsRes, "meetings");
  const followUps = rows(followUpsRes, "follow-ups");
  const isUpcoming = (m: (typeof meetings)[number]) => m.status === "scheduled" && !!m.starts_at && m.starts_at >= nowIso;
  const requested = meetings.filter((m) => m.status === "requested");
  const upcoming = meetings.filter(isUpcoming).reverse();
  const past = meetings.filter((m) => m.status !== "requested" && !isUpcoming(m));

  return (
    <>
      <PageHeader title={x.title} description={x.subtitle} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {requested.length > 0 && (
            <Card className="border-warn/40">
              <CardHeader title={fmt(x.requests, { n: requested.length })} description={x.requestsSub} />
              <ul className="divide-y divide-line">
                {requested.map((m) => (
                  <MeetingItem key={m.id} meeting={m} />
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title={x.upcoming} />
            {upcoming.length ? (
              <ul className="divide-y divide-line">
                {upcoming.map((m) => (
                  <MeetingItem key={m.id} meeting={m} />
                ))}
              </ul>
            ) : (
              <EmptyState title={x.noUpcoming} />
            )}
          </Card>
          <Card>
            <CardHeader title={x.past} />
            {past.length ? (
              <ul className="divide-y divide-line">
                {past.map((m) => (
                  <MeetingItem key={m.id} meeting={m} />
                ))}
              </ul>
            ) : (
              <EmptyState title={x.nothing} />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={x.schedule} />
            <CardBody>
              <ActionForm action={createMeeting} resetOnSuccess className="space-y-3">
                <Field label={t.common.title}>
                  <Input name="title" required />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label={x.when} className="col-span-2">
                    <Input type="datetime-local" name="starts_at" />
                  </Field>
                  <Field label={t.common.minutes}>
                    <Input type="number" name="duration_min" defaultValue={30} min={5} max={480} />
                  </Field>
                </div>
                <Field label={x.location}>
                  <Input name="location" />
                </Field>
                <Field label={x.investor}>
                  <Select name="investor_org_id" defaultValue="">
                    <option value="">—</option>
                    {rows(orgsRes, "investor orgs").map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={x.startup}>
                  <Select name="startup_id" defaultValue="">
                    <option value="">—</option>
                    {rows(startupsRes, "startups").map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={x.agenda}>
                  <Textarea name="agenda" className="min-h-16" />
                </Field>
                <div className="space-y-1 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="visible_to_investor" className="accent-brand" /> {x.showInvestor}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="visible_to_startup" className="accent-brand" /> {x.showFounder}
                  </label>
                </div>
                <SubmitButton className="w-full">{x.create}</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={x.openFollowUps} />
            <ul className="divide-y divide-line">
              {followUps.length === 0 && <li className="px-5 py-3 text-sm text-muted">{x.allDone}</li>}
              {followUps.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-2.5">
                  <ActionForm action={toggleFollowUp}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="done" value="true" />
                    <ToggleCheck checked={false} label={`${t.common.markDone}: ${f.title}`} />
                  </ActionForm>
                  <div className="min-w-0 flex-1">
                    {f.investor_id || f.startup_id ? (
                      <Link
                        href={f.investor_id ? `/admin/investors/${f.investor_id}` : `/admin/startups/${f.startup_id}`}
                        className="block truncate text-sm hover:underline"
                      >
                        {f.title}
                      </Link>
                    ) : (
                      <p className="truncate text-sm">{f.title}</p>
                    )}
                    <p className={`text-xs ${f.due_date && f.due_date < today ? "font-medium text-neg" : "text-muted"}`}>
                      {date(f.due_date, locale)}
                      {f.user_profiles?.full_name ? ` · ${f.user_profiles.full_name}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <CardBody className="border-t border-line">
              <ActionForm action={createFollowUp} resetOnSuccess className="space-y-2">
                <Input name="title" placeholder={x.newFollowUp} required aria-label={x.newFollowUp} />
                <div className="flex gap-2">
                  <Input type="date" name="due_date" aria-label={x.dueDate} />
                  <Select name="assigned_to" defaultValue="" aria-label={x.assignTo}>
                    <option value="">{t.common.me}</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </option>
                    ))}
                  </Select>
                </div>
                <SubmitButton size="sm" variant="secondary">
                  {t.common.add}
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
