import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Input, Select, Textarea } from "@/components/ui";
import { saveMeetingNotes, updateMeeting } from "@/lib/actions/meetings";
import { MEETING_TONE } from "@/lib/labels";
import { dateTime } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import type { Database } from "@/lib/database.types";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"] & {
  organizations: { name: string } | null;
  startups: { name: string } | null;
  meeting_notes: { notes: string | null; outcome: string | null } | null;
};

/** A staff view of one meeting: reschedule, change status and keep internal notes. */
export async function MeetingItem({ meeting: m }: { meeting: Meeting }) {
  const { t, locale } = await getI18n();
  const x = t.meetings;
  const notes = m.meeting_notes;
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{m.title}</p>
          <p className="text-xs text-muted">
            {[
              m.starts_at ? dateTime(m.starts_at, locale) : x.timeNotSet,
              `${m.duration_min} ${t.common.minutes}`,
              m.location,
              m.organizations?.name,
              m.startups?.name,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={MEETING_TONE[m.status]}>{t.enums.meeting_status[m.status]}</Badge>
          {m.visible_to_investor && <Badge>{x.investorSees}</Badge>}
          {m.visible_to_startup && <Badge>{x.founderSees}</Badge>}
        </div>
      </div>
      {m.agenda && <p className="mt-1 text-sm text-ink-2">{m.agenda}</p>}
      <div className="mt-3">
        <ActionForm action={updateMeeting} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={m.id} />
          <Select name="status" defaultValue={m.status === "requested" ? "scheduled" : m.status} className="h-8 w-40 text-xs" aria-label={t.common.status}>
            <option value="scheduled">{t.enums.meeting_status.scheduled}</option>
            <option value="completed">{t.enums.meeting_status.completed}</option>
            <option value="cancelled">{t.enums.meeting_status.cancelled}</option>
          </Select>
          <Input type="datetime-local" name="starts_at" className="h-8 w-52 text-xs" aria-label={x.dateTimeLabel} required={m.status === "requested"} />
          <SubmitButton size="sm" variant={m.status === "requested" ? "primary" : "secondary"}>
            {m.status === "requested" ? x.confirm : x.update}
          </SubmitButton>
        </ActionForm>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-brand-600">{notes?.notes || notes?.outcome ? x.notesToggle : x.addNotes}</summary>
        <ActionForm action={saveMeetingNotes} className="mt-2 space-y-2">
          <input type="hidden" name="meeting_id" value={m.id} />
          <Textarea name="notes" defaultValue={notes?.notes ?? ""} placeholder={x.notesPh} aria-label={x.notesPh} />
          <Input name="outcome" defaultValue={notes?.outcome ?? ""} placeholder={x.outcome} aria-label={x.outcome} />
          <SubmitButton size="sm" variant="secondary">
            {x.saveNotes}
          </SubmitButton>
        </ActionForm>
      </details>
    </li>
  );
}
