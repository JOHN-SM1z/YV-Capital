import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { addPublicRecord } from "@/lib/actions/startups";
import { RECORD_KINDS } from "@/lib/labels";
import { getDictionary } from "@/i18n/server";

export async function AddRecordForm({ startupId }: { startupId: string }) {
  const t = await getDictionary();
  const s = t.startups;
  return (
    <ActionForm action={addPublicRecord} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="startup_id" value={startupId} />
      <Field label={s.recordTitle} className="sm:col-span-2">
        <Input name="title" required maxLength={300} />
      </Field>
      <Field label={s.recordUrl} className="sm:col-span-2">
        <Input name="url" type="url" required placeholder="https://" />
      </Field>
      <Field label={s.publisher}>
        <Input name="publisher" required maxLength={120} />
      </Field>
      <Field label={s.publishedOn}>
        <Input name="published_on" type="date" />
      </Field>
      <Field label={s.kind}>
        <Select name="kind" defaultValue="news">
          {RECORD_KINDS.map((k) => (
            <option key={k} value={k}>
              {t.enums.record_kind[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={s.amount}>
        <Input name="amount_usd" inputMode="decimal" />
      </Field>
      <Field label={s.summary} className="sm:col-span-2">
        <Textarea name="summary" required maxLength={600} className="min-h-16" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton variant="secondary" size="sm">
          {t.common.add}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
