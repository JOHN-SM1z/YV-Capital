import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, KeyValue, PageHeader, Select, Textarea } from "@/components/ui";
import { askQuestion, expressInterest, requestMeeting } from "@/lib/actions/portal";
import { INTEREST_TONE, OPPORTUNITY_TONE, isRoundType, isDocType } from "@/lib/labels";
import { bytes, date, dateTime, usd, usdRange } from "@/lib/format";
import { maybeRow, rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.opportunities };
}

export default async function OpportunityRoom({ params }: PageProps<"/investor/opportunities/[id]">) {
  const { id } = await params;
  await requireUser(["investor"]);
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const p = t.investorPortal;
  // RLS returns a row only if this opportunity is shared with the investor's organization.
  const o = maybeRow(await supabase.from("investment_opportunities").select("*").eq("id", id).maybeSingle(), "opportunity");
  if (!o) notFound();

  const [cardRes, docsRes, interestRes, questionsRes] = await Promise.all([
    supabase.rpc("investor_startup_card", { p_opportunity: id }),
    supabase.rpc("investor_opportunity_documents", { p_opportunity: id }),
    supabase.from("investor_interests").select("level, indicative_amount, note, updated_at").eq("opportunity_id", id).maybeSingle(),
    supabase
      .from("due_diligence_requests")
      .select("id, question, status, created_at, due_diligence_responses(id, body, approved_at, document_id)")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const company = rows(cardRes, "company card")[0];
  const docs = rows(docsRes, "documents");
  const interest = maybeRow(interestRes, "interest");
  const questions = rows(questionsRes, "questions");
  const active = o.status === "shared";
  const statusLabel = t.enums.opportunity_status[o.status];
  const stage = o.stage && isRoundType(o.stage) ? t.enums.funding_stage[o.stage] : null;

  return (
    <>
      <PageHeader
        back={{ href: "/investor/opportunities", label: t.nav.opportunities }}
        title={o.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {[company?.sector ?? o.sector, company?.country, stage].filter(Boolean).join(" · ")}
            {company?.website && (
              <a href={company.website} target="_blank" rel="noreferrer noopener" className="text-brand-600 hover:underline">
                {t.common.websiteLink}
              </a>
            )}
            {o.status !== "shared" && <Badge tone={OPPORTUNITY_TONE[o.status]}>{statusLabel}</Badge>}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={p.overview} />
            <CardBody className="space-y-4">
              {o.thesis && <p className="text-ink-2">{o.thesis}</p>}
              <KeyValue
                items={[
                  [p.raising, usd(o.target_amount)],
                  [p.ticketRange, usdRange(o.min_ticket, o.max_ticket)],
                  [p.structure, o.structure],
                  [p.valuation, o.valuation],
                  [
                    p.company,
                    company
                      ? company.founded_year && company.team_size
                        ? fmt(p.companyLine, { name: company.name, year: company.founded_year, size: company.team_size })
                        : company.name
                      : null,
                  ],
                  [p.sharedOn, date(o.shared_at, locale)],
                ]}
              />
              {o.traction_highlights && (
                <div>
                  <p className="text-xs text-muted">{p.traction}</p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{o.traction_highlights}</p>
                </div>
              )}
              {o.use_of_proceeds && (
                <div>
                  <p className="text-xs text-muted">{p.useOfProceeds}</p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{o.use_of_proceeds}</p>
                </div>
              )}
              {o.key_risks && (
                <div>
                  <p className="text-xs text-muted">{p.risks}</p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{o.key_risks}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {o.memo && (
            <Card>
              <CardHeader title={p.memo} />
              <CardBody>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{o.memo}</div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title={p.documents} description={p.documentsSub} />
            {docs.length === 0 ? (
              <EmptyState title={p.noDocuments}>{p.noDocumentsBody}</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <a href={`/api/files/${d.id}`} className="font-medium hover:underline">
                        {d.title}
                      </a>
                      <p className="text-xs text-muted">
                        {isDocType(d.doc_type) ? t.enums.doc_type[d.doc_type] : d.doc_type} · {bytes(d.size_bytes)}
                      </p>
                    </div>
                    <a href={`/api/files/${d.id}`} className="text-sm font-medium text-brand-600">
                      {t.common.download}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={p.qa} description={p.qaSub} />
            <ul className="divide-y divide-line">
              {questions.length === 0 && <li className="px-5 py-3 text-sm text-muted">{p.noQuestions}</li>}
              {questions.map((q) => (
                <li key={q.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium whitespace-pre-wrap">{q.question}</p>
                    <Badge tone={q.status === "released" ? "pos" : q.status === "closed" ? "neutral" : "info"}>
                      {q.status === "released" ? p.answered : q.status === "closed" ? p.closed : p.inProgress}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted">{fmt(p.asked, { date: dateTime(q.created_at, locale) })}</p>
                  {q.due_diligence_responses.map((a) => (
                    <div key={a.id} className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm">
                      <p className="text-xs text-muted">{fmt(p.yv, { date: dateTime(a.approved_at, locale) })}</p>
                      <p className="whitespace-pre-wrap">{a.body}</p>
                      {a.document_id && (
                        <a href={`/api/files/${a.document_id}`} className="text-xs text-brand-600">
                          {t.common.attachedDocument}
                        </a>
                      )}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
            {active && (
              <CardBody className="border-t border-line">
                <ActionForm action={askQuestion} resetOnSuccess className="space-y-2">
                  <input type="hidden" name="opportunity_id" value={id} />
                  <Textarea name="question" placeholder={p.askPh} required aria-label={p.askPh} maxLength={4000} />
                  <SubmitButton variant="secondary" size="sm">
                    {p.sendQuestion}
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={p.yourInterest} description={p.yourInterestSub} />
            <CardBody>
              {interest && (
                <div className="mb-4 rounded-lg bg-surface px-3 py-2 text-sm">
                  <Badge tone={INTEREST_TONE[interest.level]}>{t.enums.interest_level[interest.level]}</Badge>
                  {interest.indicative_amount != null && <p className="tabular mt-1">{fmt(p.indicativeAmount, { amount: usd(interest.indicative_amount) })}</p>}
                  <p className="mt-1 text-xs text-muted">{fmt(t.common.updated, { date: dateTime(interest.updated_at, locale) })}</p>
                </div>
              )}
              {active ? (
                <ActionForm action={expressInterest} className="space-y-3">
                  <input type="hidden" name="opportunity_id" value={id} />
                  <Field label={p.response}>
                    <Select name="level" defaultValue={interest?.level ?? "interested"}>
                      <option value="interested">{p.optInterested}</option>
                      <option value="info_requested">{p.optInfo}</option>
                      <option value="indicative">{p.optIndicative}</option>
                      <option value="declined">{p.optPass}</option>
                    </Select>
                  </Field>
                  <Field label={p.amountLabel} hint={p.amountHint}>
                    <Input name="indicative_amount" defaultValue={interest?.indicative_amount ?? ""} inputMode="decimal" />
                  </Field>
                  <Field label={p.noteLabel}>
                    <Textarea name="note" defaultValue={interest?.note ?? ""} className="min-h-16" />
                  </Field>
                  <SubmitButton className="w-full">{interest ? p.updateResponse : p.sendResponse}</SubmitButton>
                </ActionForm>
              ) : (
                <p className="text-sm text-muted">{fmt(p.responsesClosed, { status: statusLabel })}</p>
              )}
            </CardBody>
          </Card>

          {active && (
            <Card>
              <CardHeader title={p.requestMeeting} />
              <CardBody>
                <ActionForm action={requestMeeting} resetOnSuccess className="space-y-3">
                  <input type="hidden" name="opportunity_id" value={id} />
                  <Field label={p.topic}>
                    <Input name="topic" defaultValue={fmt(p.topicDefault, { name: company?.name ?? o.title })} required />
                  </Field>
                  <Field label={p.availability}>
                    <Input name="availability" placeholder={p.availabilityPh} />
                  </Field>
                  <SubmitButton variant="secondary" className="w-full">
                    {p.requestMeeting}
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
