"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { dbError, fail, logServerError, ok, type ActionState } from "@/lib/action-state";
import { parseMoney, str } from "@/lib/format";
import { isRoundType } from "@/lib/labels";
import { parseParticipants } from "@/lib/funding-stats";
import { audit } from "@/lib/notify";

function revalidateFunding(startupId: string) {
  revalidatePath(`/admin/startups/${startupId}`);
  revalidatePath("/admin/insights");
  revalidatePath("/admin/startups");
  revalidatePath("/investor/portfolio", "layout");
}

/** Staff: add a round that cites one of the company's public records (the database enforces both). */
export async function addFundingRound(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z
    .object({
      startup_id: z.uuid(),
      source_record_id: z.uuid(),
      announced_on: z.iso.date().nullable(),
      note: z.string().max(300).nullable(),
    })
    .safeParse({
      startup_id: fd.get("startup_id"),
      source_record_id: fd.get("source_record_id"),
      announced_on: str(fd.get("announced_on")),
      note: str(fd.get("note")),
    });
  if (!parsed.success) return fail(t.validation.roundFields);
  const roundType = str(fd.get("round_type"));
  if (roundType !== null && !isRoundType(roundType)) return fail(t.validation.roundFields);
  const amount = parseMoney(fd.get("amount_usd"));
  if (Number.isNaN(amount) || amount === 0) return fail(t.errors.amount);
  const participants = parseParticipants(String(fd.get("participants") ?? ""));
  if (!participants) return fail(t.validation.participants);

  const supabase = await createClient();
  const { data: round, error } = await supabase
    .from("funding_rounds")
    .insert({ ...parsed.data, round_type: roundType, amount_usd: amount, added_by: user.id })
    .select("id")
    .single();
  if (error || !round) return dbError(t, error);
  const { error: partError } = await supabase
    .from("round_participants")
    .insert(participants.map((p) => ({ round_id: round.id, name: p.name, amount_usd: p.amountUsd, is_lead: p.isLead })));
  if (partError) {
    // Never leave a round without its participants.
    const { error: cleanupError } = await supabase.from("funding_rounds").delete().eq("id", round.id);
    if (cleanupError) logServerError("funding.cleanup", cleanupError);
    return dbError(t, partError);
  }
  await audit(supabase, "funding_round.added", "startup", parsed.data.startup_id, { round_id: round.id, amount_usd: amount == null ? "" : String(amount) });
  revalidateFunding(parsed.data.startup_id);
  return ok(t.msg.roundAdded);
}

export async function deleteFundingRound(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z.object({ id: z.uuid(), startup_id: z.uuid() }).safeParse({ id: fd.get("id"), startup_id: fd.get("startup_id") });
  if (!parsed.success) return fail(t.errors.generic);
  const supabase = await createClient();
  const { data, error } = await supabase.from("funding_rounds").delete().eq("id", parsed.data.id).eq("startup_id", parsed.data.startup_id).select("id");
  if (error) return dbError(t, error);
  if (!data?.length) return fail(t.errors.permission);
  await audit(supabase, "funding_round.removed", "startup", parsed.data.startup_id, { round_id: parsed.data.id });
  revalidateFunding(parsed.data.startup_id);
  return ok(t.msg.roundRemoved);
}

/**
 * Follow or unfollow a company. Who may follow what is decided by RLS (investors: portfolio companies
 * only; staff: any company; founders: none), not by this action.
 */
export async function toggleFollow(fd: FormData): Promise<void> {
  const user = await requireUser(["investor", "yv_admin", "yv_team"]);
  const startupId = z.uuid().safeParse(fd.get("startup_id"));
  if (!startupId.success) return;
  const follow = fd.get("follow") === "1";
  const supabase = await createClient();
  const { error } = follow
    ? await supabase
        .from("company_follows")
        .upsert({ user_id: user.id, startup_id: startupId.data }, { onConflict: "user_id,startup_id", ignoreDuplicates: true })
    : await supabase.from("company_follows").delete().eq("user_id", user.id).eq("startup_id", startupId.data);
  if (error) logServerError("follows.toggle", error);
  revalidatePath(user.userType === "investor" ? "/investor/portfolio" : `/admin/startups/${startupId.data}`, "layout");
}
