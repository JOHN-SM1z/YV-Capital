import { createClient } from "@/lib/supabase/server";
import { ActionForm, SubmitButton, ToggleCheck } from "@/components/action-form";
import { Card, CardBody, CardHeader, Input, Select } from "@/components/ui";
import { createFollowUp, toggleFollowUp } from "@/lib/actions/meetings";
import { date, todayTashkent } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";

export async function FollowUpsCard({ investorId, startupId, opportunityId }: { investorId?: string; startupId?: string; opportunityId?: string }) {
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  let query = supabase.from("follow_ups").select("id, title, due_date, is_done, priority").order("is_done").order("due_date", { nullsFirst: false });
  if (investorId) query = query.eq("investor_id", investorId);
  if (startupId) query = query.eq("startup_id", startupId);
  if (opportunityId) query = query.eq("opportunity_id", opportunityId);
  const followUps = rows(await query.limit(20), "follow-ups");
  const today = todayTashkent();

  return (
    <Card>
      <CardHeader title={t.admin.followUps} />
      <ul className="divide-y divide-line">
        {followUps.length === 0 && <li className="px-5 py-3 text-sm text-muted">{t.meetings.allDone}</li>}
        {followUps.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-5 py-2.5">
            <ActionForm action={toggleFollowUp}>
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="done" value={String(!f.is_done)} />
              <ToggleCheck checked={f.is_done} label={`${f.is_done ? t.common.markNotDone : t.common.markDone}: ${f.title}`} />
            </ActionForm>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${f.is_done ? "text-muted line-through" : ""}`}>{f.title}</p>
              <p className={`text-xs ${!f.is_done && f.due_date && f.due_date < today ? "font-medium text-neg" : "text-muted"}`}>{date(f.due_date, locale)}</p>
            </div>
          </li>
        ))}
      </ul>
      <CardBody className="border-t border-line">
        <ActionForm action={createFollowUp} resetOnSuccess className="space-y-2">
          {investorId && <input type="hidden" name="investor_id" value={investorId} />}
          {startupId && <input type="hidden" name="startup_id" value={startupId} />}
          {opportunityId && <input type="hidden" name="opportunity_id" value={opportunityId} />}
          <Input name="title" placeholder={t.meetings.newFollowUp} required aria-label={t.meetings.newFollowUp} />
          <div className="flex gap-2">
            <Input type="date" name="due_date" aria-label={t.meetings.dueDate} />
            <Select name="priority" defaultValue="medium" aria-label={t.common.priority}>
              <option value="high">{t.common.high}</option>
              <option value="medium">{t.common.medium}</option>
              <option value="low">{t.common.low}</option>
            </Select>
          </div>
          <SubmitButton variant="secondary" size="sm">
            {t.common.add}
          </SubmitButton>
        </ActionForm>
      </CardBody>
    </Card>
  );
}
