import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getInvestorsForMatch, getStartupsForMatch } from "@/lib/data";
import { rankInvestors } from "@/lib/matching/score";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { FitBadge } from "@/components/match-list";
import { NotesCard } from "@/components/notes-card";
import { FollowUpsCard } from "@/components/follow-ups-card";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, SandboxBadge, Select, Textarea, type ButtonVariant } from "@/components/ui";
import { attachDocument, detachDocument, revokeAccess, setOpportunityStatus, shareOpportunity, updateOpportunity } from "@/lib/actions/opportunities";
import { DD_TONE, DOC_TONE, FUNDING_STAGES, INTEREST_TONE, OPPORTUNITY_TONE, isDocType } from "@/lib/labels";
import { date, dateTime, usd } from "@/lib/format";
import { maybeRow, rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import type { Database } from "@/lib/database.types";

type Status = Database["public"]["Enums"]["opportunity_status"];

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.opportunities };
}

type StatusButtonProps = { id: string; status: Status; label: string; variant?: ButtonVariant; confirm?: string };

function StatusButton({ id, status, label, variant = "secondary", confirm }: StatusButtonProps) {
  return (
    <ActionForm action={setOpportunityStatus} confirm={confirm}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton size="sm" variant={variant}>
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

export default async function OpportunityDetail({ params }: PageProps<"/admin/opportunities/[id]">) {
  const { id } = await params;
  const me = await requireUser(STAFF);
  if (!z.uuid().safeParse(id).success) notFound();
  const admin = me.userType === "yv_admin";
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const x = t.opportunities;

  const o = maybeRow(await supabase.from("investment_opportunities").select("*, startups(id, name, org_id)").eq("id", id).maybeSingle(), "opportunity");
  if (!o) notFound();
  const startup = o.startups;

  const [accessRes, interestsRes, roomRes, startupDocsRes, questionsRes, historyRes, investors, startupRows] = await Promise.all([
    supabase.from("opportunity_access").select("investor_org_id, granted_at, organizations(name, is_demo)").eq("opportunity_id", id),
    supabase.from("investor_interests").select("investor_org_id, level, indicative_amount, note, updated_at, organizations(name)").eq("opportunity_id", id),
    supabase.from("opportunity_documents").select("document_id, startup_documents(id, title, doc_type, status)").eq("opportunity_id", id),
    supabase.from("startup_documents").select("id, title, doc_type, status").eq("startup_id", startup.id),
    supabase
      .from("due_diligence_requests")
      .select("id, question, status, created_at, organizations(name)")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunity_status_history")
      .select("from_status, to_status, created_at, user_profiles(full_name)")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
    getInvestorsForMatch(supabase),
    getStartupsForMatch(supabase, startup.id),
  ]);
  const access = rows(accessRes, "access");
  const interests = rows(interestsRes, "interests");
  const roomDocs = rows(roomRes, "data room");
  const startupDocs = rows(startupDocsRes, "startup documents");
  const questions = rows(questionsRes, "questions");
  const history = rows(historyRes, "history");

  const sharedOrgs = new Set(access.map((a) => a.investor_org_id));
  const startupForMatch = startupRows[0];
  const candidates = (startupForMatch ? rankInvestors(startupForMatch, investors) : []).flatMap((r) => {
    const inv = investors.find((i) => i.id === r.investorId);
    return inv && !sharedOrgs.has(inv.orgId) ? [{ ...r, inv }] : [];
  });
  const roomIds = new Set(roomDocs.map((d) => d.document_id));
  const addable = startupDocs.filter((d) => !roomIds.has(d.id));
  const canShare = o.status === "approved" || o.status === "shared" || o.status === "paused";
  const statusText: Record<Status, string> = {
    draft: x.stDraft,
    internal_review: admin ? x.stReviewAdmin : x.stReviewTeam,
    approved: admin ? x.stApprovedAdmin : x.stApprovedTeam,
    shared: fmt(x.stShared, { n: sharedOrgs.size }),
    paused: x.stPaused,
    closed: fmt(x.stFinal, { status: t.enums.opportunity_status.closed }),
    withdrawn: fmt(x.stFinal, { status: t.enums.opportunity_status.withdrawn }),
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/opportunities", label: t.nav.opportunities }}
        title={o.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/startups/${startup.id}`} className="text-brand-600 hover:underline">
              {startup.name}
            </Link>{" "}
            · {usd(o.target_amount)} <Badge tone={OPPORTUNITY_TONE[o.status]}>{t.enums.opportunity_status[o.status]}</Badge>
          </span>
        }
      />

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-3">
          <p className="mr-auto text-sm text-ink-2">{statusText[o.status]}</p>
          {o.status === "draft" && <StatusButton id={id} status="internal_review" label={x.submitReview} variant="primary" />}
          {o.status === "internal_review" && <StatusButton id={id} status="draft" label={x.backToDraft} />}
          {o.status === "internal_review" && admin && <StatusButton id={id} status="approved" label={x.approve} variant="primary" confirm={x.approveConfirm} />}
          {o.status === "shared" && <StatusButton id={id} status="paused" label={x.pause} />}
          {o.status === "paused" && admin && <StatusButton id={id} status="shared" label={x.resume} variant="primary" />}
          {admin && (o.status === "shared" || o.status === "paused") && <StatusButton id={id} status="closed" label={x.markClosed} confirm={x.closeConfirm} />}
          {admin && o.status !== "closed" && o.status !== "withdrawn" && (
            <StatusButton id={id} status="withdrawn" label={x.withdraw} variant="danger" confirm={x.withdrawConfirm} />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canShare && (
            <Card>
              <CardHeader title={x.access} description={x.accessSub} />
              <ul className="divide-y divide-line">
                {access.length === 0 && <li className="px-5 py-3 text-sm text-muted">{x.notShared}</li>}
                {access.map((a) => (
                  <li key={a.investor_org_id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span>
                      {a.organizations.name} {a.organizations.is_demo && <SandboxBadge label={t.common.sandbox} />}{" "}
                      <span className="text-xs text-muted">{fmt(t.common.since, { date: date(a.granted_at, locale) })}</span>
                    </span>
                    {admin && (
                      <ActionForm action={revokeAccess} confirm={x.revokeConfirm}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="org" value={a.investor_org_id} />
                        <SubmitButton size="sm" variant="ghost">
                          {x.revoke}
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
              {admin && candidates.length > 0 && (
                <CardBody className="border-t border-line">
                  <ActionForm action={shareOpportunity} confirm={x.shareConfirm} className="space-y-3">
                    <input type="hidden" name="id" value={id} />
                    <p className="text-sm font-medium">
                      {x.shareMore} <span className="font-normal text-muted">{x.sortedByFit}</span>
                    </p>
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {candidates.map((c) => (
                        <label key={c.inv.orgId} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface">
                          <input type="checkbox" name="org_ids" value={c.inv.orgId} className="size-4 accent-brand" />
                          <span className="tabular w-8 text-right text-sm font-semibold">{c.score}</span>
                          <span className="text-sm">{c.inv.name}</span>
                          <FitBadge fit={c.fit} />
                          {c.inv.isDemo && <SandboxBadge label={t.common.sandbox} />}
                        </label>
                      ))}
                    </div>
                    <SubmitButton>{x.shareSelected}</SubmitButton>
                  </ActionForm>
                </CardBody>
              )}
            </Card>
          )}

          <Card>
            <CardHeader title={x.content} description={x.contentSub} />
            <CardBody>
              <ActionForm action={updateOpportunity} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <Field label={t.common.title}>
                  <Input name="title" defaultValue={o.title} required />
                </Field>
                <Field label={x.thesis}>
                  <Textarea name="thesis" defaultValue={o.thesis ?? ""} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={t.common.sector}>
                    <Input name="sector" defaultValue={o.sector ?? ""} />
                  </Field>
                  <Field label={t.common.stage}>
                    <Select name="stage" defaultValue={o.stage ?? ""}>
                      <option value="">—</option>
                      {FUNDING_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {t.enums.funding_stage[s]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={x.raising}>
                    <Input name="target_amount" defaultValue={o.target_amount ?? ""} />
                  </Field>
                  <Field label={x.minTicket}>
                    <Input name="min_ticket" defaultValue={o.min_ticket ?? ""} />
                  </Field>
                  <Field label={x.maxTicket}>
                    <Input name="max_ticket" defaultValue={o.max_ticket ?? ""} />
                  </Field>
                  <Field label={x.reviewDate}>
                    <Input type="date" name="review_date" defaultValue={o.review_date ?? ""} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={x.valuation} hint={x.valuationHint}>
                    <Input name="valuation" defaultValue={o.valuation ?? ""} />
                  </Field>
                  <Field label={x.structure}>
                    <Input name="structure" defaultValue={o.structure ?? ""} />
                  </Field>
                </div>
                <Field label={x.useOfProceeds}>
                  <Textarea name="use_of_proceeds" defaultValue={o.use_of_proceeds ?? ""} />
                </Field>
                <Field label={x.traction} hint={x.tractionHint}>
                  <Textarea name="traction_highlights" defaultValue={o.traction_highlights ?? ""} />
                </Field>
                <Field label={x.risks}>
                  <Textarea name="key_risks" defaultValue={o.key_risks ?? ""} />
                </Field>
                <Field label={x.memo} hint={x.memoHint}>
                  <Textarea name="memo" defaultValue={o.memo ?? ""} className="min-h-48" />
                </Field>
                <SubmitButton>{t.common.save}</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={x.dataRoom} description={x.dataRoomSub} />
            <ul className="divide-y divide-line">
              {roomDocs.length === 0 && <li className="px-5 py-3 text-sm text-muted">{x.noDocs}</li>}
              {roomDocs.map((d) => {
                const doc = d.startup_documents;
                return (
                  <li key={d.document_id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span>
                      <a href={`/api/files/${doc.id}`} className="hover:underline">
                        {doc.title}
                      </a>{" "}
                      <span className="text-xs text-muted">{isDocType(doc.doc_type) ? t.enums.doc_type[doc.doc_type] : doc.doc_type}</span>{" "}
                      <Badge tone={DOC_TONE[doc.status]}>{t.enums.doc_status[doc.status]}</Badge>
                    </span>
                    <ActionForm action={detachDocument}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="document_id" value={doc.id} />
                      <SubmitButton size="sm" variant="ghost">
                        {t.common.remove}
                      </SubmitButton>
                    </ActionForm>
                  </li>
                );
              })}
            </ul>
            {addable.length > 0 && (
              <CardBody className="border-t border-line">
                <ActionForm action={attachDocument} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={id} />
                  <Select name="document_id" className="max-w-96" aria-label={t.activity.colDocument}>
                    {addable.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} — {t.enums.doc_status[d.status]}
                      </option>
                    ))}
                  </Select>
                  <SubmitButton size="sm" variant="secondary">
                    {x.addToRoom}
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            )}
          </Card>

          <NotesCard entityType="opportunity" entityId={id} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={x.interest} description={x.interestSub} />
            <ul className="divide-y divide-line">
              {interests.length === 0 && <li className="px-5 py-3 text-sm text-muted">{x.noResponses}</li>}
              {interests.map((i) => (
                <li key={i.investor_org_id} className="px-5 py-3 text-sm">
                  <p className="font-medium">{i.organizations.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone={INTEREST_TONE[i.level]}>{t.enums.interest_level[i.level]}</Badge>
                    {i.indicative_amount != null && (
                      <span className="tabular text-xs text-ink-2">{fmt(x.nonBinding, { amount: usd(i.indicative_amount) })}</span>
                    )}
                  </div>
                  {i.note && <p className="mt-1 text-xs text-ink-2">“{i.note}”</p>}
                  <p className="mt-1 text-xs text-muted">{dateTime(i.updated_at, locale)}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title={x.questions}
              actions={
                <Link href="/admin/diligence" className="text-sm font-medium text-brand-600">
                  {x.qaQueue}
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {questions.length === 0 && <li className="px-5 py-3 text-sm text-muted">{x.noQuestions}</li>}
              {questions.map((q) => (
                <li key={q.id} className="px-5 py-3 text-sm">
                  <p className="line-clamp-2">{q.question}</p>
                  <p className="mt-1 text-xs text-muted">
                    {q.organizations.name} · <Badge tone={DD_TONE[q.status]}>{t.enums.dd_status[q.status]}</Badge>
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <FollowUpsCard opportunityId={id} />

          <Card>
            <CardHeader title={x.history} />
            <ul className="space-y-1 px-5 py-3 text-xs text-muted">
              {history.length === 0 && <li>{fmt(x.created, { date: date(o.created_at, locale) })}</li>}
              {history.map((h) => (
                <li key={h.created_at}>
                  {date(h.created_at, locale)}: {h.from_status ? t.enums.opportunity_status[h.from_status] : "—"} →{" "}
                  <span className="text-ink-2">{t.enums.opportunity_status[h.to_status]}</span>
                  {h.user_profiles?.full_name ? ` · ${h.user_profiles.full_name}` : ""}
                </li>
              ))}
            </ul>
            {roomDocs.length === 0 && canShare && <p className="border-t border-line px-5 py-3 text-xs text-warn">{x.roomTip}</p>}
          </Card>
          {!canShare && (
            <Card className="p-4">
              <EmptyState title={x.notShareable}>{x.notShareableBody}</EmptyState>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
