import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { MEETING_TONE } from "@/lib/labels";
import { dateTime } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.founderPortal.meetingsTitle };
}

export default async function FounderMeetings() {
  await requireUser(["founder"]);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const f = t.founderPortal;
  const meetings = rows(
    await supabase.from("meetings").select("id, title, starts_at, duration_min, location, agenda, status").order("starts_at", { ascending: false }),
    "meetings",
  );
  return (
    <>
      <PageHeader title={f.meetingsTitle} description={f.meetingsSub} />
      <Card>
        {meetings.length === 0 ? (
          <EmptyState title={f.noMeetings}>{f.noMeetingsBody}</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {meetings.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{m.title}</p>
                  <Badge tone={MEETING_TONE[m.status]}>{t.enums.meeting_status[m.status]}</Badge>
                </div>
                <p className="text-xs text-muted">
                  {[dateTime(m.starts_at, locale), `${m.duration_min} ${t.common.minutes}`, m.location].filter(Boolean).join(" · ")}
                </p>
                {m.agenda && <p className="mt-1 text-sm text-ink-2">{m.agenda}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
