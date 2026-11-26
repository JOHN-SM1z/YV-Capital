import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, CardBody, CardHeader, Textarea } from "@/components/ui";
import { addNote } from "@/lib/actions/investors";
import { dateTime } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";

/** Internal-only notes and assessments (staff RLS). */
export async function NotesCard({ entityType, entityId }: { entityType: "investor" | "startup" | "opportunity"; entityId: string }) {
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const notes = rows(
    await supabase
      .from("notes")
      .select("id, body, is_assessment, created_at, user_profiles(full_name)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false }),
    "notes",
  );

  return (
    <Card>
      <CardHeader title={t.notes.title} description={t.notes.subtitle} />
      <CardBody>
        <ActionForm action={addNote} resetOnSuccess className="space-y-2">
          <input type="hidden" name="entity_type" value={entityType} />
          <input type="hidden" name="entity_id" value={entityId} />
          <Textarea name="body" placeholder={t.notes.placeholder} aria-label={t.notes.title} required />
          <div className="flex items-center justify-between gap-2">
            {entityType !== "investor" ? (
              <label className="flex items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" name="is_assessment" className="accent-brand" /> {t.notes.assessment}
              </label>
            ) : (
              <span />
            )}
            <SubmitButton variant="secondary" size="sm">
              {t.notes.add}
            </SubmitButton>
          </div>
        </ActionForm>
      </CardBody>
      <ul className="divide-y divide-line border-t border-line">
        {notes.map((n) => (
          <li key={n.id} className="px-5 py-3">
            <p className="text-xs text-muted">
              {n.user_profiles?.full_name ?? "YV"} · {dateTime(n.created_at, locale)} {n.is_assessment && <Badge tone="dark">{t.notes.assessmentBadge}</Badge>}
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{n.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
