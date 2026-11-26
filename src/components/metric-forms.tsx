import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { addMetric, saveFundraising } from "@/lib/actions/startups";
import { METRIC_KEYS, ROUND_TYPES } from "@/lib/labels";
import { getDictionary } from "@/i18n/server";
import type { Database } from "@/lib/database.types";

export async function AddMetricForm({ startupId, staff }: { startupId: string; staff: boolean }) {
  const t = await getDictionary();
  const m = t.metrics;
  return (
    <ActionForm action={addMetric} resetOnSuccess className="grid gap-2 sm:grid-cols-6">
      <input type="hidden" name="startup_id" value={startupId} />
      <Field label={m.metric} className="sm:col-span-2">
        <Select name="metric_key">
          {METRIC_KEYS.map((k) => (
            <option key={k} value={k}>
              {t.enums.metric[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={m.value}>
        <Input name="value" inputMode="decimal" required />
      </Field>
      <Field label={t.common.unit}>
        <Select name="unit" defaultValue="USD">
          <option value="USD">USD</option>
          <option value="% MoM">% MoM</option>
          <option value="% YoY">% YoY</option>
          <option value="count">№</option>
        </Select>
      </Field>
      <Field label={m.period} className="sm:col-span-2">
        <Input name="period" placeholder={m.periodPh} required />
      </Field>
      <Field label={m.source} className="sm:col-span-4" hint={staff ? undefined : m.sourceHint}>
        <Input name="source" placeholder={staff ? m.sourceStaffPh : m.sourceFounderPh} required={staff} />
      </Field>
      <div className="flex items-end gap-3 sm:col-span-2">
        {staff && (
          <label className="flex items-center gap-1.5 pb-2.5 text-xs">
            <input type="checkbox" name="verified" className="accent-brand" /> {m.verified}
          </label>
        )}
        <SubmitButton variant="secondary">{m.addMetric}</SubmitButton>
      </div>
    </ActionForm>
  );
}

type Round = Database["public"]["Tables"]["startup_fundraising"]["Row"];

export async function FundraisingForm({ startupId, staff, current }: { startupId: string; staff: boolean; current?: Round | null }) {
  const t = await getDictionary();
  const m = t.metrics;
  return (
    <ActionForm action={saveFundraising} className="space-y-3">
      <input type="hidden" name="startup_id" value={startupId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={m.round}>
          <Select name="round_type" defaultValue={current?.round_type ?? "seed"}>
            {ROUND_TYPES.map((r) => (
              <option key={r} value={r}>
                {t.enums.funding_stage[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={m.raising} hint={m.raisingHint}>
          <Input name="target_amount" defaultValue={current?.target_amount ?? ""} inputMode="decimal" />
        </Field>
        <Field label={m.valuation}>
          <Input name="valuation_expectation" defaultValue={current?.valuation_expectation ?? ""} inputMode="decimal" />
        </Field>
        <Field label={m.minTicket}>
          <Input name="min_ticket" defaultValue={current?.min_ticket ?? ""} inputMode="decimal" />
        </Field>
        <Field label={m.maxTicket}>
          <Input name="max_ticket" defaultValue={current?.max_ticket ?? ""} inputMode="decimal" />
        </Field>
      </div>
      <Field label={m.useOfFunds}>
        <Textarea name="use_of_funds" defaultValue={current?.use_of_funds ?? ""} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={m.currentInvestors}>
          <Input name="current_investors" defaultValue={current?.current_investors ?? ""} />
        </Field>
        <Field label={m.previousFunding}>
          <Input name="previous_funding" defaultValue={current?.previous_funding ?? ""} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary">{m.saveVersion}</SubmitButton>
        {staff && (
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" name="verified" className="accent-brand" /> {m.verified}
          </label>
        )}
      </div>
    </ActionForm>
  );
}
