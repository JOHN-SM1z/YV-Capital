import { requireUser } from "@/lib/auth";
import { getMyStartup } from "@/lib/founder-data";
import { DocumentUpload } from "@/components/document-upload";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { DOC_TONE, DOC_TYPES, isDocType } from "@/lib/labels";
import { bytes, date } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.documents };
}

export default async function FounderDocuments() {
  await requireUser(["founder"]);
  const { supabase, startup } = await getMyStartup();
  const { t, locale } = await getI18n();
  const f = t.founderPortal;
  const docs = rows(
    await supabase
      .from("startup_documents")
      .select("id, title, doc_type, status, review_note, size_bytes, created_at")
      .eq("startup_id", startup.id)
      .order("created_at", { ascending: false }),
    "documents",
  );
  const have = new Set(docs.map((d) => d.doc_type));
  const checklist = DOC_TYPES.filter((k) => k !== "other" && k !== "product_info");

  return (
    <>
      <PageHeader title={f.docsTitle} description={f.docsSub} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={f.uploadDoc} />
            <CardBody>
              <DocumentUpload strings={t.upload} docTypeLabels={t.enums.doc_type} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={f.yourDocs} />
            {docs.length === 0 ? (
              <EmptyState title={f.nothingUploaded} />
            ) : (
              <ul className="divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <a href={`/api/files/${d.id}`} className="font-medium hover:underline">
                        {d.title}
                      </a>
                      <Badge tone={DOC_TONE[d.status]}>{t.enums.doc_status[d.status]}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {fmt(f.uploadedLine, {
                        type: isDocType(d.doc_type) ? t.enums.doc_type[d.doc_type] : d.doc_type,
                        size: bytes(d.size_bytes),
                        date: date(d.created_at, locale),
                      })}
                    </p>
                    {d.review_note && <p className="mt-1 rounded-md bg-surface px-3 py-1.5 text-sm text-ink-2">{fmt(f.yvNote, { note: d.review_note })}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader title={f.askedFor} />
          <ul className="divide-y divide-line">
            {checklist.map((k) => (
              <li key={k} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                {t.enums.doc_type[k]}
                {have.has(k) ? <Badge tone="pos">{f.uploaded}</Badge> : <Badge>{f.notSubmitted}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
