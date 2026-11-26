import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { updateStartupProfile } from "@/lib/actions/startups";
import { FUNDING_STAGES, SECTORS } from "@/lib/labels";
import { getDictionary } from "@/i18n/server";
import type { Database } from "@/lib/database.types";

type Startup = Database["public"]["Tables"]["startups"]["Row"];

/** Company profile editor used by founders (own company) and YV staff. */
export async function StartupProfileForm({ s }: { s: Startup }) {
  const t = await getDictionary();
  const f = t.profileForm;
  // Keep an existing sector selectable even if it isn't in the standard list.
  const sectors = [...new Set([...(s.sector ? [s.sector] : []), ...SECTORS])];
  return (
    <ActionForm action={updateStartupProfile} className="space-y-3">
      <input type="hidden" name="id" value={s.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.common.website}>
          <Input name="website" type="url" defaultValue={s.website ?? ""} placeholder="https://" />
        </Field>
        <Field label={t.common.city}>
          <Input name="headquarters" defaultValue={s.headquarters ?? ""} />
        </Field>
        <Field label={t.common.sector}>
          <Select name="sector" defaultValue={s.sector ?? ""}>
            <option value="">{t.common.choose}</option>
            {sectors.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Field>
        <Field label={t.startups.fundingStage}>
          <Select name="funding_stage" defaultValue={s.funding_stage ?? ""}>
            <option value="">{t.common.notSet}</option>
            {FUNDING_STAGES.map((k) => (
              <option key={k} value={k}>
                {t.enums.funding_stage[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={f.teamSize}>
          <Input name="team_size" type="number" min={0} defaultValue={s.team_size ?? ""} />
        </Field>
        <Field label={f.foundedYear}>
          <Input name="founded_year" type="number" min={1990} max={2100} defaultValue={s.founded_year ?? ""} />
        </Field>
      </div>
      <Field label={f.oneLiner}>
        <Input name="one_liner" maxLength={200} defaultValue={s.one_liner ?? ""} />
      </Field>
      <Field label={f.whatItDoes}>
        <Textarea name="description" defaultValue={s.description ?? ""} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={f.problem}>
          <Textarea name="problem" defaultValue={s.problem ?? ""} />
        </Field>
        <Field label={f.solution}>
          <Textarea name="solution" defaultValue={s.solution ?? ""} />
        </Field>
        <Field label={f.targetMarket}>
          <Textarea name="target_market" defaultValue={s.target_market ?? ""} />
        </Field>
        <Field label={f.businessModel}>
          <Textarea name="business_model" defaultValue={s.business_model ?? ""} />
        </Field>
      </div>
      <SubmitButton>{f.save}</SubmitButton>
    </ActionForm>
  );
}
