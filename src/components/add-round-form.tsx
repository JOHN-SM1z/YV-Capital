import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { addFundingRound, deleteFundingRound } from "@/lib/actions/funding";
import { ROUND_TYPES } from "@/lib/labels";
import { getDictionary } from "@/i18n/server";

type RecordOption = { id: string; title: string; publisher: string; published_on: string | null };

/** Staff form: a round can only be created from one of the company's own public records. */
export async function AddRoundForm({ startupId, records }: { startupId: string; records: RecordOption[] }) {
  const t = await getDictionary();
  const f = t.funding;
  if (records.length === 0) return <p className="text-sm text-muted">{f.needRecord}</p>;
  return (
    <ActionForm action={addFundingRound} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="startup_id" value={startupId} />
      <Field label={f.sourceRecord} className="sm:col-span-2">
        <Select name="source_record_id" required defaultValue="">
          <option value="" disabled>
            —
          </option>
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.publisher} — {r.title.length > 80 ? `${r.title.slice(0, 80)}…` : r.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={f.reportedOn}>
        <Input name="announced_on" type="date" />
      </Field>
      <Field label={f.amount}>
        <Input name="amount_usd" inputMode="decimal" placeholder="150000" />
      </Field>
      <Field label={f.roundType}>
        <Select name="round_type" defaultValue="">
          <option value="">{f.notStated}</option>
          {ROUND_TYPES.map((r) => (
            <option key={r} value={r}>
              {t.enums.funding_stage[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={f.note}>
        <Input name="note" maxLength={300} />
      </Field>
      <Field label={f.participants} hint={f.participantsHelp} className="sm:col-span-2">
        <Textarea name="participants" required className="min-h-20 font-mono text-xs" placeholder={f.participantsPh} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton variant="secondary" size="sm">
          {f.add}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export async function RemoveRoundButton({ roundId, startupId }: { roundId: string; startupId: string }) {
  const t = await getDictionary();
  return (
    <ActionForm action={deleteFundingRound} confirm={t.funding.removeConfirm}>
      <input type="hidden" name="id" value={roundId} />
      <input type="hidden" name="startup_id" value={startupId} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="…">
        {t.funding.remove}
      </SubmitButton>
    </ActionForm>
  );
}
