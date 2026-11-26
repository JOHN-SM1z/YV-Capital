import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader } from "@/components/ui";
import { requestMeeting } from "@/lib/actions/portal";
import { MEETING_TONE } from "@/lib/labels";
import { dateTime } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.investorPortal.meetingsTitle };
}

export default async function InvestorMeetings() {
  await requireUser(["investor"]);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const p = t.investorPortal;
  const meetings = rows(
    await supabase
      .from("meetings")
      .select("id, title, starts_at, duration_min, location, agenda, status")
      .order("starts_at", { ascending: false, nullsFirst: true }),
    "meetings",
  );

  return (
    <>
      <PageHeader title={p.meetingsTitle} description={p.meetingsSub} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {meetings.length === 0 ? (
            <EmptyState title={p.noMeetings} />
          ) : (
            <ul className="divide-y divide-line">
              {meetings.map((m) => (
                <li key={m.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{m.title}</p>
                    <Badge tone={MEETING_TONE[m.status]}>{t.enums.meeting_status[m.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {[m.starts_at ? `${dateTime(m.starts_at, locale)} · ${m.duration_min} ${t.common.minutes}` : p.tbc, m.location].filter(Boolean).join(" · ")}
                  </p>
                  {m.agenda && <p className="mt-1 text-sm text-ink-2">{m.agenda}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title={p.requestWithYv} />
          <CardBody>
            <ActionForm action={requestMeeting} resetOnSuccess className="space-y-3">
              <Field label={p.topic}>
                <Input name="topic" placeholder={p.topicPh} required />
              </Field>
              <Field label={p.availability}>
                <Input name="availability" placeholder={p.availabilityPh2} />
              </Field>
              <SubmitButton className="w-full">{p.requestMeeting}</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
