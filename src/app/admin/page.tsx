import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Progress, Stat } from "@/components/ui";
import { PipelineChart } from "@/components/pipeline-chart";
import { ActionForm, ToggleCheck } from "@/components/action-form";
import { toggleFollowUp } from "@/lib/actions/meetings";
import { LIKELIHOOD_ORDER, LIKELIHOOD_TONE, RELATIONSHIP_TONE, isKeyOf } from "@/lib/labels";
import { date, dateTime, todayTashkent, usd } from "@/lib/format";
import { maybeRow, rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { Constants } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.overview };
}

export default async function Overview() {
  const user = await requireUser(STAFF);
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const today = todayTashkent();
  const nowIso = new Date().toISOString();

  const [kpiRes, targetsRes, stagesRes, followUpsRes, meetingsRes, openQsRes, activeOppsRes, myInvestorsRes, myStartupsRes, outlookRes] = await Promise.all([
    supabase.from("program_kpis").select("*").maybeSingle(),
    supabase.from("program_kpi_targets").select("*, user_profiles(full_name)").order("sort_order"),
    supabase.from("startups").select("stage").is("deleted_at", null),
    supabase
      .from("follow_ups")
      .select("id, title, due_date, priority, investor_id, startup_id, assigned_to")
      .eq("is_done", false)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("meetings").select("id, title, starts_at, status, owner_id").gte("starts_at", nowIso).neq("status", "cancelled").order("starts_at"),
    supabase.from("due_diligence_requests").select("id", { count: "exact", head: true }).in("status", ["open", "with_startup", "answered"]),
    supabase.from("investment_opportunities").select("id", { count: "exact", head: true }).in("status", ["shared", "approved"]),
    supabase
      .from("investor_relationships")
      .select("investor_id, status, next_follow_up_at, investors(organizations(name))")
      .eq("owner_id", user.id)
      .order("next_follow_up_at", { nullsFirst: false }),
    supabase.from("startups").select("id, name, stage").eq("owner_id", user.id).is("deleted_at", null),
    supabase.from("startup_round_outlook").select("startup_id, likelihood, expected_window, startups(name)").in("likelihood", ["high", "medium"]),
  ]);

  const kpi = maybeRow(kpiRes, "kpis");
  const targets = rows(targetsRes, "kpi targets");
  const followUps = rows(followUpsRes, "follow-ups");
  const meetings = rows(meetingsRes, "meetings");
  const myInvestors = rows(myInvestorsRes, "my investors");
  const myStartups = rows(myStartupsRes, "my startups");
  const outlooks = rows(outlookRes, "outlooks").sort(
    (a, b) => LIKELIHOOD_ORDER[a.likelihood] - LIKELIHOOD_ORDER[b.likelihood] || (a.startups?.name ?? "").localeCompare(b.startups?.name ?? ""),
  );

  const kpiValues: Record<string, number | null> = kpi ?? {};
  const counts = new Map<string, number>();
  for (const s of rows(stagesRes, "stages")) counts.set(s.stage, (counts.get(s.stage) ?? 0) + 1);
  const chartData = Constants.public.Enums.pipeline_stage
    .filter((s) => s !== "submitted" && (counts.get(s) ?? 0) > 0)
    .map((s) => ({ stage: t.enums.pipeline_stage[s], count: counts.get(s) ?? 0 }));

  const myFollowUps = followUps.filter((f) => f.assigned_to === user.id);
  const myMeetings = meetings.filter((m) => m.owner_id === user.id);
  const deskEmpty = !myInvestors.length && !myStartups.length && !myFollowUps.length && !myMeetings.length;
  const kpiText = (key: string) => (isKeyOf(t.kpi, key) ? t.kpi[key] : null);

  return (
    <>
      <PageHeader title={fmt(t.admin.greeting, { name: user.fullName.split(" ")[0] || user.email })} description={t.admin.overviewSub} />

      <Card className="mb-8">
        <CardHeader title={t.admin.desk} description={t.admin.deskSub} />
        {deskEmpty ? (
          <EmptyState title={t.admin.deskEmpty} />
        ) : (
          <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
            <section className="bg-card p-4">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                {t.admin.myFollowUps} · {myFollowUps.length}
              </h3>
              <ul className="mt-2 space-y-2">
                {myFollowUps.slice(0, 5).map((f) => (
                  <li key={f.id} className="text-sm">
                    <p>{f.title}</p>
                    <p className={f.due_date && f.due_date < today ? "text-xs font-medium text-neg" : "text-xs text-muted"}>{date(f.due_date, locale)}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="bg-card p-4">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                {t.admin.myInvestors} · {myInvestors.length}
              </h3>
              <ul className="mt-2 space-y-2">
                {myInvestors.slice(0, 5).map((r) => (
                  <li key={r.investor_id} className="text-sm">
                    <Link href={`/admin/investors/${r.investor_id}`} className="hover:underline">
                      {r.investors.organizations.name}
                    </Link>
                    <p>
                      <Badge tone={RELATIONSHIP_TONE[r.status]}>{t.enums.relationship_status[r.status]}</Badge>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="bg-card p-4">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                {t.admin.myStartups} · {myStartups.length}
              </h3>
              <ul className="mt-2 space-y-2">
                {myStartups.slice(0, 5).map((s) => (
                  <li key={s.id} className="text-sm">
                    <Link href={`/admin/startups/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted">{t.enums.pipeline_stage[s.stage]}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="bg-card p-4">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                {t.admin.myMeetings} · {myMeetings.length}
              </h3>
              <ul className="mt-2 space-y-2">
                {myMeetings.slice(0, 5).map((m) => (
                  <li key={m.id} className="text-sm">
                    <p>{m.title}</p>
                    <p className="text-xs text-muted">{dateTime(m.starts_at, locale)}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </Card>

      <section aria-labelledby="kpi-h" className="mb-8">
        <h2 id="kpi-h" className="mb-3 text-sm font-semibold text-ink-2">
          {t.admin.targets}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map((target) => {
            const actual = Number(kpiValues[target.key] ?? 0);
            const goal = Number(target.target);
            const done = goal > 0 && actual >= goal;
            const pct = goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0;
            const text = kpiText(target.key);
            return (
              <Card key={target.key} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{text?.label ?? target.label}</p>
                  {done && <Badge tone="pos">{t.admin.targetMet}</Badge>}
                </div>
                <p className="tabular mt-2 font-display text-2xl font-semibold">
                  {actual}
                  <span className="text-base font-normal text-muted">
                    {" "}
                    / {goal}
                    {target.target_max ? `–${target.target_max}` : ""}
                  </span>
                </p>
                <div className="mt-2">
                  <Progress value={actual} max={goal} tone={done ? "pos" : "brand"} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {fmt(t.admin.ofTarget, { pct, source: text?.source ?? target.data_source })}
                  {target.user_profiles?.full_name ? fmt(t.admin.ownerLine, { name: target.user_profiles.full_name }) : ""}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="cap-h" className="mb-8">
        <h2 id="cap-h" className="mb-3 text-sm font-semibold text-ink-2">
          {t.admin.capital}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t.admin.potential} value={usd(Number(kpi?.potential_interest_usd ?? 0))} hint={t.admin.potentialHint} />
          <Stat label={t.admin.indicative} value={usd(Number(kpi?.indicative_interest_usd ?? 0))} hint={t.admin.indicativeHint} />
          <Stat label={t.admin.signed} value="—" hint={t.admin.signedHint} />
          <Stat label={t.admin.transferred} value="—" hint={t.admin.transferredHint} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title={t.admin.pipeline}
              description={fmt(t.admin.pipelineSub, { n: counts.get("submitted") ?? 0, o: activeOppsRes.count ?? 0 })}
              actions={
                <Link className="text-sm font-medium text-brand-600" href="/admin/startups">
                  {t.common.viewAll}
                </Link>
              }
            />
            <CardBody>
              {chartData.length ? (
                <PipelineChart data={chartData} label={t.admin.chartLabel} />
              ) : (
                <EmptyState title={t.admin.pipelineEmpty}>{t.admin.pipelineEmptyBody}</EmptyState>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t.admin.nextRoundsCard}
              description={t.admin.nextRoundsCardSub}
              actions={
                <Link className="text-sm font-medium text-brand-600" href="/admin/next-rounds">
                  {t.admin.seeAll}
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {outlooks.slice(0, 6).map((o) => (
                <li key={o.startup_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                  <Link href={`/admin/startups/${o.startup_id}`} className="text-sm font-medium hover:underline">
                    {o.startups?.name}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {o.expected_window}
                    <Badge tone={LIKELIHOOD_TONE[o.likelihood]}>{t.enums.round_likelihood[o.likelihood]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title={t.admin.followUps}
              actions={
                <Link className="text-sm font-medium text-brand-600" href="/admin/meetings">
                  {t.common.all}
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {followUps.length === 0 && <li className="px-5 py-4 text-sm text-muted">{t.admin.nothingDue}</li>}
              {followUps.slice(0, 8).map((f) => {
                const overdue = !!f.due_date && f.due_date < today;
                const href = f.investor_id ? `/admin/investors/${f.investor_id}` : f.startup_id ? `/admin/startups/${f.startup_id}` : "/admin/meetings";
                return (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                    <ActionForm action={toggleFollowUp}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="done" value="true" />
                      <ToggleCheck checked={false} label={`${t.common.markDone}: ${f.title}`} />
                    </ActionForm>
                    <div className="min-w-0 flex-1">
                      <Link href={href} className="block truncate text-sm hover:underline">
                        {f.title}
                      </Link>
                      <p className={overdue ? "text-xs font-medium text-neg" : "text-xs text-muted"}>
                        {overdue ? `${t.admin.overdue} · ` : ""}
                        {date(f.due_date, locale)}
                      </p>
                    </div>
                    {f.priority === "high" && <Badge tone="brand">{t.common.high}</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t.admin.upcomingMeetings} />
            <ul className="divide-y divide-line">
              {meetings.length === 0 && <li className="px-5 py-4 text-sm text-muted">{t.admin.noMeetings}</li>}
              {meetings.slice(0, 5).map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <p className="text-sm">{m.title}</p>
                  <p className="text-xs text-muted">{dateTime(m.starts_at, locale)}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <p className="text-sm">
              <span className="font-display text-xl font-semibold">{openQsRes.count ?? 0}</span> {t.admin.openQuestions}
            </p>
            <Link href="/admin/diligence" className="mt-1 inline-block text-sm font-medium text-brand-600">
              {t.admin.qaQueue}
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
