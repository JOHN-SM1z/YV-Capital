import { requireUser } from "@/lib/auth";
import { getMyStartup } from "@/lib/founder-data";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, EmptyState, PageHeader, Select, Textarea } from "@/components/ui";
import { respondToRequest } from "@/lib/actions/portal";
import { REQUEST_TONE } from "@/lib/labels";
import { date, dateTime } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.requests };
}

export default async function FounderRequests() {
  await requireUser(["founder"]);
  const { supabase, startup } = await getMyStartup();
  const { t, locale } = await getI18n();
  const f = t.founderPortal;
  const [requestsRes, docsRes] = await Promise.all([
    // Founders only see YV's request text, never which investor (if any) prompted it.
    supabase
      .from("startup_requests")
      .select("id, title, body, due_date, status, created_at, startup_request_responses(id, body, created_at, document_id)")
      .eq("startup_id", startup.id)
      .order("status")
      .order("created_at", { ascending: false }),
    supabase.from("startup_documents").select("id, title").eq("startup_id", startup.id).order("created_at", { ascending: false }),
  ]);
  const requests = rows(requestsRes, "requests");
  const docs = rows(docsRes, "documents");

  return (
    <>
      <PageHeader title={f.requestsTitle} description={f.requestsSub} />
      {requests.length === 0 ? (
        <Card>
          <EmptyState title={f.noRequests} />
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{r.title}</p>
                <Badge tone={REQUEST_TONE[r.status]}>{t.enums.founder_request_status[r.status]}</Badge>
              </div>
              <p className="text-xs text-muted">
                {fmt(f.sent, { date: date(r.created_at, locale) })}
                {r.due_date ? fmt(f.dueLine, { date: date(r.due_date, locale) }) : ""}
              </p>
              {r.body && <p className="mt-2 text-sm whitespace-pre-wrap text-ink-2">{r.body}</p>}
              {r.startup_request_responses.map((a) => (
                <div key={a.id} className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm">
                  <p className="text-xs text-muted">{fmt(f.yourAnswer, { date: dateTime(a.created_at, locale) })}</p>
                  <p className="whitespace-pre-wrap">{a.body}</p>
                </div>
              ))}
              {r.status !== "closed" && (
                <ActionForm action={respondToRequest} resetOnSuccess className="mt-3 space-y-2">
                  <input type="hidden" name="request_id" value={r.id} />
                  <Textarea name="body" placeholder={r.startup_request_responses.length ? f.moreInfoPh : f.answerPh} required aria-label={f.answerPh} />
                  <div className="flex flex-wrap items-center gap-2">
                    {docs.length > 0 && (
                      <Select name="document_id" defaultValue="" className="max-w-72" aria-label={t.common.attachedDocument}>
                        <option value="">{t.common.noAttachment}</option>
                        {docs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </Select>
                    )}
                    <SubmitButton size="sm">{f.sendToYv}</SubmitButton>
                  </div>
                </ActionForm>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
