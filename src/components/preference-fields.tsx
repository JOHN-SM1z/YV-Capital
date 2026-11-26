import { Field, Input, Select } from "@/components/ui";
import { FUNDING_STAGES, GEOGRAPHIES, SECTORS } from "@/lib/labels";
import { getDictionary } from "@/i18n/server";
import type { Database } from "@/lib/database.types";

type Prefs = Partial<Database["public"]["Tables"]["investor_preferences"]["Row"]>;

type Option = { value: string; label: string };

function Checks({ name, options, selected, legend }: { name: string; options: Option[]; selected: string[]; legend: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-2">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(({ value, label }) => (
          <label key={value} className="cursor-pointer">
            <input type="checkbox" name={name} value={value} defaultChecked={selected.includes(value)} className="peer sr-only" />
            <span className="inline-block rounded-md border border-line bg-card px-2 py-1 text-xs text-ink-2 peer-checked:border-brand peer-checked:bg-brand-50 peer-checked:text-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40">
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const asOptions = (values: string[]): Option[] => values.map((v) => ({ value: v, label: v }));

/** Investment-preference inputs shared by YV staff and investor org admins. They feed the matching engine. */
export async function PreferenceFields({ p = {}, showCoInvest = true }: { p?: Prefs; showCoInvest?: boolean }) {
  const t = await getDictionary();
  return (
    <div className="space-y-4">
      <Checks name="sectors" legend={t.prefs.sectors} options={asOptions(SECTORS)} selected={p.sectors ?? []} />
      <Checks
        name="stages"
        legend={t.prefs.stages}
        options={FUNDING_STAGES.map((s) => ({ value: s, label: t.enums.funding_stage[s] }))}
        selected={p.stages ?? []}
      />
      <Checks name="geographies" legend={t.prefs.geographies} options={asOptions(GEOGRAPHIES)} selected={p.geographies ?? []} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t.prefs.minCheck} hint={t.prefs.minHint}>
          <Input name="min_check" defaultValue={p.min_check ?? ""} inputMode="decimal" />
        </Field>
        <Field label={t.prefs.maxCheck} hint={t.prefs.maxHint}>
          <Input name="max_check" defaultValue={p.max_check ?? ""} inputMode="decimal" />
        </Field>
        {showCoInvest && (
          <Field label={t.prefs.coInvest}>
            <Select name="co_invest_appetite" defaultValue={p.co_invest_appetite ?? ""}>
              <option value="">{t.common.unknown}</option>
              <option value="high">{t.common.high}</option>
              <option value="medium">{t.common.medium}</option>
              <option value="low">{t.common.low}</option>
            </Select>
          </Field>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="central_asia_interest" defaultChecked={p.central_asia_interest} className="size-4 accent-brand" />
        {t.prefs.caInterest}
      </label>
    </div>
  );
}
