import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { closeQuestion, draftResponse, releaseResponse, routeToStartup } from "@/lib/actions/diligence";
import { DD_TONE } from "@/lib/labels";
import { dateTime } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.diligence };
}

export default async function DiligencePage({ searchParams }: PageProps<"/admin/diligence">) {
  await requireUser(STAFF);
  const sp = await searchParams;
  const showClosed = sp.closed === "1";
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const d = t.diligence;
  let query = supabase
    .from("due_diligence_requests")
    .select(
      "id, question, status, created_at, organizations(name), investment_opportunities(id, title, startup_id), due_diligence_responses(id, body, approved_for_release, approved_at, created_at, document_id), startup_requests(id, status, startup_request_responses(id, body, created_at, document_id))",
    )
    .order("created_at", { ascending: false });
  if (!showClosed) query = query.not("status", "in", "(released,closed)");
  const items = rows(await query, "questions");

  const startupIds = [...new Set(items.map((i) => i.investment_opportunities.startup_id))];
  const docs = startupIds.length
    ? rows(await supabase.from("startup_documents").select("id, title, startup_id").in("startup_id", startupIds), "documents")
    : [];

  return (
    <>
      <PageHeader
        title={d.title}
        description={d.subtitle}
        actions={
          <Link href={showClosed ? "/admin/diligence" : "?closed=1"} className="text-sm font-medium text-brand-600">
            {showClosed ? d.hideClosed : d.showClosed}
          </Link>
        }
      />
      {items.length === 0 ? (
        <Card>
          <EmptyState title={d.clear}>{d.clearBody}</EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const opp = item.investment_opportunities;
            const founderAnswers = item.startup_requests.flatMap((r) => r.startup_request_responses);
            const oppDocs = docs.filter((doc) => doc.startup_id === opp.startup_id);
            return (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">
                      {item.organizations.name} ·{" "}
                      <Link href={`/admin/opportunities/${opp.id}`} className="hover:underline">
                        {opp.title}
                      </Link>{" "}
                      · {dateTime(item.created_at, locale)}
                    </p>
                    <p className="mt-1 font-medium whitespace-pre-wrap">{item.question}</p>
                  </div>
                  <Badge tone={DD_TONE[item.status]}>{t.enums.dd_status[item.status]}</Badge>
                </div>

                <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">{d.founderInput}</p>
                    {item.startup_requests.length === 0 ? (
                      <ActionForm action={routeToStartup} className="space-y-2">
                        <input type="hidden" name="dd_request_id" value={item.id} />
                        <Input name="title" defaultValue={d.defaultTitle} aria-label={t.common.title} required />
                        <Textarea name="body" defaultValue={item.question} className="min-h-20" aria-label={t.startups.requestDetails} />
                        <div className="flex items-center gap-2">
                          <Input type="date" name="due_date" className="max-w-44" aria-label={t.meetings.dueDate} />
                          <SubmitButton size="sm" variant="secondary">
                            {d.sendToFounder}
                          </SubmitButton>
                        </div>
                        <p className="text-xs text-muted">{d.identityHint}</p>
                      </ActionForm>
                    ) : founderAnswers.length === 0 ? (
                      <p className="text-sm text-muted">{d.waitingFounder}</p>
                    ) : (
                      founderAnswers.map((a) => (
                        <div key={a.id} className="rounded-lg bg-surface px-3 py-2 text-sm">
                          <p className="text-xs text-muted">{fmt(d.founderAnswer, { date: dateTime(a.created_at, locale) })}</p>
                          <p className="whitespace-pre-wrap">{a.body}</p>
                          {a.document_id && (
                            <a className="text-xs text-brand-600" href={`/api/files/${a.document_id}`}>
                              {t.common.attachedDocument}
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">{d.answerInvestor}</p>
                    {item.due_diligence_responses.map((r) => (
                      <div
                        key={r.id}
                        className={`rounded-lg border px-3 py-2 text-sm ${r.approved_for_release ? "border-pos/30 bg-pos-50" : "border-warn/30 bg-warn-50"}`}
                      >
                        <p className="text-xs text-muted">
                          {r.approved_for_release ? fmt(d.releasedOn, { date: dateTime(r.approved_at, locale) }) : d.draftHidden}
                        </p>
                        <p className="whitespace-pre-wrap">{r.body}</p>
                        {!r.approved_for_release && (
                          <ActionForm action={releaseResponse} confirm={d.releaseConfirm} className="mt-2">
                            <input type="hidden" name="id" value={r.id} />
                            <SubmitButton size="sm">{d.approveRelease}</SubmitButton>
                          </ActionForm>
                        )}
                      </div>
                    ))}
                    {item.status !== "closed" && (
                      <ActionForm action={draftResponse} resetOnSuccess className="space-y-2">
                        <input type="hidden" name="request_id" value={item.id} />
                        <Textarea name="body" placeholder={d.answerPh} className="min-h-20" aria-label={d.answerPh} required />
                        {oppDocs.length > 0 && (
                          <Select name="document_id" defaultValue="" aria-label={t.activity.colDocument}>
                            <option value="">{d.noDoc}</option>
                            {oppDocs.map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                {doc.title}
                              </option>
                            ))}
                          </Select>
                        )}
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" name="release" className="accent-brand" /> {d.releaseNow}
                          </label>
                          <SubmitButton size="sm" variant="secondary">
                            {d.saveAnswer}
                          </SubmitButton>
                        </div>
                      </ActionForm>
                    )}
                    {item.status !== "closed" && (
                      <ActionForm action={closeQuestion}>
                        <input type="hidden" name="id" value={item.id} />
                        <SubmitButton size="sm" variant="ghost">
                          {d.closeQuestion}
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
