import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyStartup, profileCompletion } from "@/lib/founder-data";
import { getPublicRecords } from "@/lib/data";
import { ActionForm, ToggleCheck } from "@/components/action-form";
import { PublicRecordsList } from "@/components/public-records";
import { Badge, Card, CardHeader, PageHeader, Progress } from "@/components/ui";
import { toggleReadinessTask } from "@/lib/actions/startups";
import { DOC_TONE } from "@/lib/labels";
import { date, dateTime } from "@/lib/format";
import { taskTitle } from "@/lib/readiness";
import { maybeRow, rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.overview };
}

export default async function FounderOverview() {
  const me = await requireUser(["founder"]);
  const { supabase, startup } = await getMyStartup();
  const { t, locale } = await getI18n();
  const f = t.founderPortal;
  const [tasksRes, requestsRes, docsRes, meetingsRes, roundRes, records] = await Promise.all([
    supabase.from("startup_readiness_tasks").select("*").eq("startup_id", startup.id).order("sort_order"),
    supabase
      .from("startup_requests")
      .select("id, title, due_date, status")
      .eq("startup_id", startup.id)
      .eq("status", "open")
      .order("due_date", { nullsFirst: false }),
    supabase
      .from("startup_documents")
      .select("id, title, status, review_note, updated_at")
      .eq("startup_id", startup.id)
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase.from("meetings").select("id, title, starts_at, location").gte("starts_at", new Date().toISOString()).order("starts_at"),
    supabase.from("startup_fundraising").select("id, created_at").eq("startup_id", startup.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    getPublicRecords(supabase, startup.id),
  ]);
  const tasks = rows(tasksRes, "tasks");
  const requests = rows(requestsRes, "requests");
  const feedback = rows(docsRes, "documents").filter((d) => d.review_note);
  const meetings = rows(meetingsRes, "meetings");
  const round = maybeRow(roundRes, "round");
  const completion = profileCompletion(startup);
  const done = tasks.filter((task) => task.is_done).length;

  return (
    <>
      <PageHeader title={fmt(f.hi, { name: me.fullName.split(" ")[0] || me.email })} description={startup.name} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{f.whereYouAre}</p>
          <p className="mt-1 font-display text-lg font-semibold">{t.enums.founder_stage[startup.stage]}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{f.profile}</p>
          <p className="mt-1 font-display text-lg font-semibold">{fmt(f.complete, { pct: completion.pct })}</p>
          <div className="mt-2">
            <Progress value={completion.filled} max={completion.total} />
          </div>
          {completion.pct < 100 && (
            <Link href="/startup/profile" className="mt-2 inline-block text-xs font-medium text-brand-600">
              {f.finishProfile}
            </Link>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{f.fundraising}</p>
          <p className="mt-1 font-display text-lg font-semibold">{round ? f.submitted : f.notSubmitted}</p>
          <p className="text-xs text-muted">
            {round ? (
              fmt(f.lastUpdated, { date: date(round.created_at, locale) })
            ) : (
              <Link href="/startup/profile#fundraising" className="font-medium text-brand-600">
                {f.addRound}
              </Link>
            )}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title={f.readiness} description={fmt(f.readinessSub, { done, total: tasks.length })} />
            <ul className="divide-y divide-line">
              {tasks.map((task) => {
                const title = taskTitle(t, task.title);
                return (
                  <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <ActionForm action={toggleReadinessTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="done" value={String(!task.is_done)} />
                      <ToggleCheck checked={task.is_done} label={`${task.is_done ? t.common.markNotDone : t.common.markDone}: ${title}`} />
                    </ActionForm>
                    <div>
                      <p className={`text-sm ${task.is_done ? "text-muted line-through" : ""}`}>{title}</p>
                      {task.description && <p className="text-xs text-muted">{task.description}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <CardHeader title={f.publicRecords} description={f.publicRecordsSub} />
            <PublicRecordsList records={records} />
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={f.requests}
              actions={
                <Link href="/startup/requests" className="text-sm font-medium text-brand-600">
                  {f.open}
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {requests.length === 0 && <li className="px-5 py-3 text-sm text-muted">{f.nothingPending}</li>}
              {requests.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <Link href="/startup/requests" className="text-sm font-medium hover:underline">
                    {r.title}
                  </Link>
                  {r.due_date && <p className="text-xs text-muted">{fmt(f.due, { date: date(r.due_date, locale) })}</p>}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={f.feedback} />
            <ul className="divide-y divide-line">
              {feedback.length === 0 && <li className="px-5 py-3 text-sm text-muted">{f.noFeedback}</li>}
              {feedback.map((d) => (
                <li key={d.id} className="px-5 py-3 text-sm">
                  <p className="font-medium">
                    {d.title} <Badge tone={DOC_TONE[d.status]}>{t.enums.doc_status[d.status]}</Badge>
                  </p>
                  <p className="text-ink-2">{d.review_note}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={f.upcomingMeetings} />
            <ul className="divide-y divide-line">
              {meetings.length === 0 && <li className="px-5 py-3 text-sm text-muted">{f.noneScheduled}</li>}
              {meetings.map((m) => (
                <li key={m.id} className="px-5 py-3 text-sm">
                  <p>{m.title}</p>
                  <p className="text-xs text-muted">{[dateTime(m.starts_at, locale), m.location].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
