import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getInvestorsForMatch, getPublicRecords, getStaff, getStartupsForMatch, realInvestors } from "@/lib/data";
import { rankInvestors } from "@/lib/matching/score";
import { ActionForm, SubmitButton, ToggleCheck } from "@/components/action-form";
import { MatchRow } from "@/components/match-list";
import { NotesCard } from "@/components/notes-card";
import { FollowUpsCard } from "@/components/follow-ups-card";
import { StartupProfileForm } from "@/components/startup-profile-form";
import { AddMetricForm, FundraisingForm } from "@/components/metric-forms";
import { PublicRecordsList } from "@/components/public-records";
import { AddRecordForm } from "@/components/add-record-form";
import { AddRoundForm, RemoveRoundButton } from "@/components/add-round-form";
import { FundingCard } from "@/components/funding-card";
import { FollowButton } from "@/components/follow-button";
import { getFollowedIds, getRounds } from "@/lib/funding";
import { CompanyLogo } from "@/components/company-logo";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, KeyValue, PageHeader, Select, Table, Td, Textarea, Th } from "@/components/ui";
import {
  addFounder,
  addReadinessTask,
  assignStartupOwner,
  changeStage,
  createStartupRequest,
  reviewDocument,
  saveOutlook,
  toggleReadinessTask,
  verifyMetric,
} from "@/lib/actions/startups";
import { createOpportunity } from "@/lib/actions/opportunities";
import { inviteUser } from "@/lib/actions/team";
import { LIKELIHOOD_TONE, OPPORTUNITY_TONE, REQUEST_TONE, VERIFICATION_TONE, isMetricKey, isRoundType, isDocType } from "@/lib/labels";
import { bytes, date, dateTime, metricValue, usd, usdRange } from "@/lib/format";
import { taskTitle } from "@/lib/readiness";
import { maybeRow, rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { Constants } from "@/lib/database.types";

export async function generateMetadata() {
  return { title: (await getI18n()).t.startups.title };
}

export default async function StartupDetail({ params }: PageProps<"/admin/startups/[id]">) {
  const { id } = await params;
  const me = await requireUser(STAFF);
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const st = t.startups;

  const s = maybeRow(await supabase.from("startups").select("*, organizations(id, is_demo)").eq("id", id).maybeSingle(), "startup");
  if (!s) notFound();
  const org = s.organizations;

  const [
    staff,
    metricsRes,
    roundsRes,
    docsRes,
    tasksRes,
    foundersRes,
    requestsRes,
    oppsRes,
    historyRes,
    membersRes,
    records,
    outlookRes,
    investors,
    startupRows,
    fundingRounds,
    followed,
    followersRes,
  ] = await Promise.all([
    getStaff(supabase),
    supabase.from("startup_metrics").select("*").eq("startup_id", id).order("created_at", { ascending: false }),
    supabase.from("startup_fundraising").select("*").eq("startup_id", id).order("created_at", { ascending: false }),
    supabase.from("startup_documents").select("*").eq("startup_id", id).order("created_at", { ascending: false }),
    supabase.from("startup_readiness_tasks").select("*").eq("startup_id", id).order("sort_order"),
    supabase.from("startup_founders").select("*").eq("startup_id", id).order("created_at"),
    supabase
      .from("startup_requests")
      .select("*, startup_request_responses(id, body, created_at, document_id)")
      .eq("startup_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("investment_opportunities").select("id, title, status").eq("startup_id", id),
    supabase
      .from("startup_status_history")
      .select("from_stage, to_stage, created_at, user_profiles(full_name)")
      .eq("startup_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("organization_members").select("id, is_active, user_profiles(full_name, email)").eq("org_id", org.id),
    getPublicRecords(supabase, id),
    supabase.from("startup_round_outlook").select("*").eq("startup_id", id).maybeSingle(),
    getInvestorsForMatch(supabase),
    getStartupsForMatch(supabase, id),
    getRounds(supabase, id),
    getFollowedIds(supabase, me.id),
    // Staff-only signal (RLS): how many investor users follow this company.
    supabase
      .from("company_follows")
      .select("user_id, user_profiles!inner(user_type)", { count: "exact", head: true })
      .eq("startup_id", id)
      .eq("user_profiles.user_type", "investor"),
  ]);
  if (followersRes.error) throw new Error(`Query failed: followers (${followersRes.error.code ?? "unknown"})`);
  const investorFollowers = followersRes.count ?? 0;
  const metrics = rows(metricsRes, "metrics");
  const rounds = rows(roundsRes, "rounds");
  const docs = rows(docsRes, "documents");
  const tasks = rows(tasksRes, "tasks");
  const founders = rows(foundersRes, "founders");
  const requests = rows(requestsRes, "requests");
  const opps = rows(oppsRes, "opportunities");
  const history = rows(historyRes, "history");
  const members = rows(membersRes, "members");
  const outlook = maybeRow(outlookRes, "outlook");

  const startupForMatch = startupRows[0];
  const matches = startupForMatch
    ? rankInvestors(startupForMatch, realInvestors(investors))
        .filter((m) => m.fit !== "none")
        .slice(0, 6)
    : [];
  // Metrics arrive newest first, so the first row per key is the current value.
  const latestByKey = new Map<string, (typeof metrics)[number]>();
  for (const m of metrics) if (!latestByKey.has(m.metric_key)) latestByKey.set(m.metric_key, m);
  const round = rounds[0];
  const doneTasks = tasks.filter((task) => task.is_done).length;
  const stageLabel = (v: string | null) => (v && isRoundType(v) ? t.enums.funding_stage[v] : null);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/startups", label: t.nav.startups }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <CompanyLogo name={s.name} url={s.logo_url} size={44} />
            {s.name}
            {s.is_portfolio && <Badge tone="brand">{st.portfolioBadge}</Badge>}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            {[s.sector, s.headquarters ?? s.country, stageLabel(s.funding_stage)].filter(Boolean).join(" · ")}
            {s.website && (
              <a href={s.website} target="_blank" rel="noreferrer noopener" className="text-brand-600 hover:underline">
                {t.common.websiteLink}
              </a>
            )}
            {s.yv_check_usd != null && (
              <Badge tone="pos">
                {st.yvCheck}: {usd(s.yv_check_usd)}
              </Badge>
            )}
          </span>
        }
        actions={
          <>
            <span className="text-xs text-muted" title={t.follow.staffExplainer}>
              {investorFollowers > 0 ? fmt(t.follow.staffSignal, { n: investorFollowers }) : t.follow.staffSignalNone}
            </span>
            <FollowButton startupId={id} name={s.name} following={followed.has(id)} t={t} size="md" />
            <Link href={`/admin/matching?startup=${id}`} className="text-sm font-medium text-brand-600">
              {t.investors.openInMatching}
            </Link>
            <ActionForm action={createOpportunity}>
              <input type="hidden" name="startup_id" value={id} />
              <SubmitButton>{st.createOpportunity}</SubmitButton>
            </ActionForm>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FundingCard
            rounds={fundingRounds}
            renderActions={(r) => <RemoveRoundButton roundId={r.id} startupId={id} />}
            footer={
              <CardBody className="border-t border-line">
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-brand-600">{t.funding.addTitle}</summary>
                  <p className="mt-2 text-xs text-muted">{t.funding.addSub}</p>
                  <div className="mt-3">
                    <AddRoundForm startupId={id} records={records} />
                  </div>
                </details>
              </CardBody>
            }
          />
          <Card id="records">
            <CardHeader title={`${st.records} · ${records.length}`} description={st.recordsSub} />
            <PublicRecordsList records={records} />
            <CardBody className="border-t border-line">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-600">{st.addRecord}</summary>
                <div className="mt-3">
                  <AddRecordForm startupId={id} />
                </div>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={st.bestFit} description={st.bestFitSub} />
            {matches.length ? (
              <ul className="divide-y divide-line">
                {matches.map((m) => (
                  <MatchRow key={m.investorId} href={`/admin/investors/${m.investorId}`} name={m.investorName} result={m} />
                ))}
              </ul>
            ) : (
              <EmptyState title={st.noFit}>{st.noFitBody}</EmptyState>
            )}
          </Card>

          <Card>
            <CardHeader title={st.keyMetrics} description={st.keyMetricsSub} />
            {latestByKey.size === 0 ? (
              <EmptyState title={st.noMetrics}>{st.noMetricsBody}</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{st.colMetric}</Th>
                    <Th>{t.common.value}</Th>
                    <Th>{t.common.period}</Th>
                    <Th>{t.common.source}</Th>
                    <Th>{t.common.status}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {[...latestByKey.values()].map((m) => (
                    <tr key={m.id}>
                      <Td className="font-medium">{isMetricKey(m.metric_key) ? t.enums.metric[m.metric_key] : m.metric_key}</Td>
                      <Td className="tabular">{metricValue(Number(m.value), m.unit)}</Td>
                      <Td className="text-ink-2">{m.period}</Td>
                      <Td className="max-w-48 text-xs text-ink-2">
                        {m.source}
                        <div className="text-muted">{fmt(t.common.updated, { date: date(m.created_at, locale) })}</div>
                      </Td>
                      <Td>
                        <Badge tone={VERIFICATION_TONE[m.verification]}>{t.enums.verification_status[m.verification]}</Badge>
                      </Td>
                      <Td>
                        {(m.verification === "founder_submitted" || m.verification === "public_source") && (
                          <div className="flex gap-1">
                            <ActionForm action={verifyMetric}>
                              <input type="hidden" name="id" value={m.id} />
                              <SubmitButton size="sm" variant="secondary" name="verdict" value="verify">
                                {st.verify}
                              </SubmitButton>
                            </ActionForm>
                            <ActionForm action={verifyMetric}>
                              <input type="hidden" name="id" value={m.id} />
                              <SubmitButton size="sm" variant="ghost" name="verdict" value="reject">
                                {st.reject}
                              </SubmitButton>
                            </ActionForm>
                          </div>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <CardBody className="border-t border-line">
              <AddMetricForm startupId={id} staff />
              {metrics.length > latestByKey.size && <p className="mt-2 text-xs text-muted">{fmt(st.history, { n: metrics.length - latestByKey.size })}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={st.fundraising}
              description={round ? fmt(st.fundraisingSub, { date: date(round.created_at, locale), n: rounds.length }) : st.notSubmitted}
              actions={round && <Badge tone={VERIFICATION_TONE[round.verification]}>{t.enums.verification_status[round.verification]}</Badge>}
            />
            <CardBody className="space-y-4">
              {round && (
                <KeyValue
                  items={[
                    [t.metrics.round, stageLabel(round.round_type)],
                    [st.raising, usd(round.target_amount)],
                    [st.ticketRange, usdRange(round.min_ticket, round.max_ticket)],
                    [st.valuation, usd(round.valuation_expectation)],
                    [st.useOfFunds, round.use_of_funds],
                    [st.currentInvestors, round.current_investors],
                  ]}
                />
              )}
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-600">{st.updateFundraising}</summary>
                <div className="mt-3">
                  <FundraisingForm startupId={id} staff current={round} />
                </div>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={st.documents} description={st.documentsSub} />
            {docs.length === 0 ? (
              <EmptyState title={st.noDocuments} />
            ) : (
              <ul className="divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <a href={`/api/files/${d.id}`} className="font-medium hover:underline">
                        {d.title}
                      </a>
                      <p className="text-xs text-muted">
                        {[
                          isDocType(d.doc_type) ? t.enums.doc_type[d.doc_type] : d.doc_type,
                          bytes(d.size_bytes),
                          date(d.created_at, locale),
                          t.enums.classification[d.classification],
                        ].join(" · ")}
                      </p>
                    </div>
                    <ActionForm action={reviewDocument} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={d.id} />
                      <Select name="status" defaultValue={d.status} className="h-8 w-44 text-xs" aria-label={t.common.status}>
                        {Constants.public.Enums.doc_status.map((v) => (
                          <option key={v} value={v}>
                            {t.enums.doc_status[v]}
                          </option>
                        ))}
                      </Select>
                      <Input
                        name="review_note"
                        defaultValue={d.review_note ?? ""}
                        placeholder={st.noteToFounder}
                        className="h-8 w-48 text-xs"
                        aria-label={st.noteToFounder}
                      />
                      <SubmitButton size="sm" variant="secondary">
                        {t.common.save}
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={st.requests} />
            <ul className="divide-y divide-line">
              {requests.length === 0 && <li className="px-5 py-3 text-sm text-muted">{st.noRequests}</li>}
              {requests.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{r.title}</p>
                    <Badge tone={REQUEST_TONE[r.status]}>{t.enums.request_status[r.status]}</Badge>
                    {r.dd_request_id && <Badge tone="info">{st.fromQa}</Badge>}
                  </div>
                  {r.body && <p className="mt-1 text-sm text-ink-2">{r.body}</p>}
                  {r.startup_request_responses.map((resp) => (
                    <div key={resp.id} className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm">
                      <p className="text-xs text-muted">{fmt(st.founderReply, { date: dateTime(resp.created_at, locale) })}</p>
                      <p className="whitespace-pre-wrap">{resp.body}</p>
                      {resp.document_id && (
                        <a className="text-xs text-brand-600" href={`/api/files/${resp.document_id}`}>
                          {t.common.attachedDocument}
                        </a>
                      )}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
            <CardBody className="border-t border-line">
              <ActionForm action={createStartupRequest} resetOnSuccess className="grid gap-2 sm:grid-cols-4">
                <input type="hidden" name="startup_id" value={id} />
                <Input name="title" placeholder={st.requestTitle} required className="sm:col-span-3" aria-label={st.requestTitle} />
                <Input type="date" name="due_date" aria-label={t.meetings.dueDate} />
                <Textarea name="body" placeholder={st.requestDetails} className="min-h-16 sm:col-span-4" aria-label={st.requestDetails} />
                <SubmitButton variant="secondary" size="sm">
                  {st.sendRequest}
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={st.profile} description={st.profileSub} />
            <CardBody className="space-y-4">
              <KeyValue
                items={[
                  [st.description, s.description ?? s.one_liner],
                  [st.problem, s.problem],
                  [st.solution, s.solution],
                  [st.targetMarket, s.target_market],
                  [st.businessModel, s.business_model],
                  [st.teamSize, s.team_size],
                  [st.founded, s.founded_year],
                ]}
              />
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-600">{st.editProfile}</summary>
                <div className="mt-3">
                  <StartupProfileForm s={s} />
                </div>
              </details>
            </CardBody>
          </Card>

          <NotesCard entityType="startup" entityId={id} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={st.outlook}
              description={st.outlookSub}
              actions={outlook && <Badge tone={LIKELIHOOD_TONE[outlook.likelihood]}>{t.enums.round_likelihood[outlook.likelihood]}</Badge>}
            />
            <CardBody className="space-y-3">
              {outlook && (
                <>
                  {outlook.expected_window && <p className="text-sm font-medium">{outlook.expected_window}</p>}
                  <p className="text-sm text-ink-2">{outlook.rationale}</p>
                  {outlook.signals.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {outlook.signals.map((sig) => (
                        <Badge key={sig}>{sig}</Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted">{fmt(st.assessedOn, { date: date(outlook.assessed_at, locale) })}</p>
                </>
              )}
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-600">{st.saveOutlook}</summary>
                <ActionForm action={saveOutlook} className="mt-3 space-y-2">
                  <input type="hidden" name="startup_id" value={id} />
                  <Field label={st.likelihood}>
                    <Select name="likelihood" defaultValue={outlook?.likelihood ?? "insufficient_data"}>
                      {Constants.public.Enums.round_likelihood.map((v) => (
                        <option key={v} value={v}>
                          {t.enums.round_likelihood[v]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={st.window}>
                    <Input name="expected_window" defaultValue={outlook?.expected_window ?? ""} maxLength={60} />
                  </Field>
                  <Field label={st.rationale}>
                    <Textarea name="rationale" defaultValue={outlook?.rationale ?? ""} required />
                  </Field>
                  <Field label={st.signals}>
                    <Textarea name="signals" defaultValue={outlook?.signals.join("\n") ?? ""} className="min-h-16" />
                  </Field>
                  <SubmitButton size="sm">{st.saveOutlook}</SubmitButton>
                </ActionForm>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={st.pipeline} description={st.pipelineSub} />
            <CardBody className="space-y-3">
              <ActionForm action={changeStage} className="space-y-2">
                <input type="hidden" name="id" value={id} />
                <Select name="stage" defaultValue={s.stage} aria-label={t.startups.colStage}>
                  {Constants.public.Enums.pipeline_stage.map((v) => (
                    <option key={v} value={v}>
                      {t.enums.pipeline_stage[v]}
                    </option>
                  ))}
                </Select>
                <SubmitButton size="sm" className="w-full">
                  {st.updateStage}
                </SubmitButton>
              </ActionForm>
              <ActionForm action={assignStartupOwner} className="space-y-2">
                <input type="hidden" name="id" value={id} />
                <Field label={st.yvOwner}>
                  <Select name="owner_id" defaultValue={s.owner_id ?? ""}>
                    <option value="">{t.common.unassigned}</option>
                    {staff.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </Select>
                </Field>
                <SubmitButton size="sm" variant="secondary" className="w-full">
                  {st.assign}
                </SubmitButton>
              </ActionForm>
              {history.length > 0 && (
                <ul className="space-y-1 border-t border-line pt-3 text-xs text-muted">
                  {history.map((h) => (
                    <li key={h.created_at}>
                      {date(h.created_at, locale)}: {h.from_stage ? t.enums.pipeline_stage[h.from_stage] : "—"} →{" "}
                      <span className="text-ink-2">{t.enums.pipeline_stage[h.to_stage]}</span>
                      {h.user_profiles?.full_name ? ` · ${h.user_profiles.full_name}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={st.readiness} description={fmt(st.readinessSub, { done: doneTasks, total: tasks.length })} />
            <ul className="divide-y divide-line">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 px-5 py-2.5">
                  <ActionForm action={toggleReadinessTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="done" value={String(!task.is_done)} />
                    <ToggleCheck checked={task.is_done} label={`${task.is_done ? t.common.markNotDone : t.common.markDone}: ${taskTitle(t, task.title)}`} />
                  </ActionForm>
                  <span className={`text-sm ${task.is_done ? "text-muted line-through" : ""}`}>{taskTitle(t, task.title)}</span>
                </li>
              ))}
            </ul>
            <CardBody className="border-t border-line">
              <ActionForm action={addReadinessTask} resetOnSuccess className="flex gap-2">
                <input type="hidden" name="startup_id" value={id} />
                <Input name="title" placeholder={st.customTask} aria-label={st.customTask} required />
                <SubmitButton size="sm" variant="secondary">
                  {t.common.add}
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={st.opportunities} />
            <ul className="divide-y divide-line">
              {opps.length === 0 && <li className="px-5 py-3 text-sm text-muted">{st.noOpportunities}</li>}
              {opps.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                  <Link href={`/admin/opportunities/${o.id}`} className="text-sm font-medium hover:underline">
                    {o.title}
                  </Link>
                  <Badge tone={OPPORTUNITY_TONE[o.status]}>{t.enums.opportunity_status[o.status]}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={st.team} />
            <ul className="divide-y divide-line">
              {founders.map((f) => (
                <li key={f.id} className="px-5 py-2.5 text-sm">
                  {f.full_name} <span className="text-muted">· {f.role}</span>
                  {f.linkedin && (
                    <a href={f.linkedin} target="_blank" rel="noreferrer noopener" className="ml-1 text-xs text-brand-600">
                      {t.common.linkedin}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <CardBody className="border-t border-line">
              <ActionForm action={addFounder} resetOnSuccess className="space-y-2">
                <input type="hidden" name="startup_id" value={id} />
                <div className="flex gap-2">
                  <Input name="full_name" placeholder={st.name} required aria-label={st.name} />
                  <Input name="role" placeholder={st.role} aria-label={st.role} />
                </div>
                <SubmitButton size="sm" variant="secondary">
                  {t.common.add}
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <FollowUpsCard startupId={id} />

          <Card>
            <CardHeader title={st.founderAccess} />
            <ul className="divide-y divide-line">
              {members.length === 0 && <li className="px-5 py-3 text-sm text-muted">{st.noFounderAccounts}</li>}
              {members.map((m) => (
                <li key={m.id} className="px-5 py-2.5 text-sm">
                  {m.user_profiles.full_name} <span className="text-xs text-muted">{m.user_profiles.email}</span>{" "}
                  {!m.is_active && <Badge tone="neg">{t.investors.removed}</Badge>}
                </li>
              ))}
            </ul>
            {me.userType === "yv_admin" && (
              <CardBody className="border-t border-line">
                <ActionForm action={inviteUser} resetOnSuccess className="space-y-2">
                  <input type="hidden" name="org_id" value={org.id} />
                  <input type="hidden" name="user_type" value="founder" />
                  <Input name="full_name" placeholder={st.founderName} required aria-label={st.founderName} />
                  <Input name="email" type="email" placeholder={t.common.email} required aria-label={t.common.email} />
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="is_org_admin" className="accent-brand" /> {st.canInvite}
                  </label>
                  <SubmitButton size="sm" variant="secondary">
                    {st.inviteFounder}
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
