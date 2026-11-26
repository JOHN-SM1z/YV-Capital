"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { dbError, fail, ok, type ActionState } from "@/lib/action-state";
import { parseMoney, str } from "@/lib/format";
import { isFundingStage } from "@/lib/labels";
import { audit, notifyOrg } from "@/lib/notify";
import { Constants } from "@/lib/database.types";

const E = Constants.public.Enums;

/** Investor-facing title stage names (stored content is written in English). */
const STAGE_TITLE: Record<string, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  growth: "Growth",
  bridge: "Bridge",
};

export async function createOpportunity(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const startupId = z.uuid().safeParse(fd.get("startup_id"));
  if (!startupId.success) return fail(t.validation.pickStartup);
  const supabase = await createClient();
  const [startup, round] = await Promise.all([
    supabase.from("startups").select("name, sector, one_liner, funding_stage").eq("id", startupId.data).single(),
    supabase.from("startup_fundraising").select("*").eq("startup_id", startupId.data).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (startup.error || !startup.data) return dbError(t, startup.error, t.validation.companyNotFound);
  if (round.error) return dbError(t, round.error);

  const s = startup.data;
  const r = round.data;
  const stage = r?.round_type ?? s.funding_stage;
  const { data, error } = await supabase
    .from("investment_opportunities")
    .insert({
      startup_id: startupId.data,
      title: `${s.name} — ${(stage && STAGE_TITLE[stage]) || "Investment opportunity"}`,
      thesis: s.one_liner,
      sector: s.sector,
      stage,
      target_amount: r?.target_amount ?? null,
      min_ticket: r?.min_ticket ?? null,
      max_ticket: r?.max_ticket ?? null,
      use_of_proceeds: r?.use_of_funds ?? null,
      status: "draft",
      owner_id: user.id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return dbError(t, error);
  revalidatePath("/admin/opportunities");
  redirect(`/admin/opportunities/${data.id}`);
}

export async function updateOpportunity(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("id"));
  const title = str(fd.get("title"));
  if (!id.success || !title) return fail(t.validation.titleRequired);
  const [target, minTicket, maxTicket] = ["target_amount", "min_ticket", "max_ticket"].map((k) => parseMoney(fd.get(k)));
  if ([target, minTicket, maxTicket].some((v) => Number.isNaN(v))) return fail(t.errors.amount);
  if (minTicket != null && maxTicket != null && minTicket > maxTicket) return fail(t.errors.checkRange);
  const stage = fd.get("stage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_opportunities")
    .update({
      title,
      thesis: str(fd.get("thesis")),
      sector: str(fd.get("sector")),
      stage: isFundingStage(stage) ? stage : null,
      target_amount: target,
      min_ticket: minTicket,
      max_ticket: maxTicket,
      valuation: str(fd.get("valuation")),
      structure: str(fd.get("structure")),
      use_of_proceeds: str(fd.get("use_of_proceeds")),
      traction_highlights: str(fd.get("traction_highlights")),
      key_risks: str(fd.get("key_risks")),
      memo: str(fd.get("memo")),
      review_date: str(fd.get("review_date")),
      updated_by: user.id,
    })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return dbError(t, error, t.errors.notFound);
  revalidatePath(`/admin/opportunities/${id.data}`);
  return ok(t.msg.opportunitySaved);
}

/** Status transitions. The database enforces who may approve, share or close. */
export async function setOpportunityStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z.object({ id: z.uuid(), status: z.enum(E.opportunity_status) }).safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return fail(t.validation.pickStatus);
  const supabase = await createClient();
  const { data, error } = await supabase.from("investment_opportunities").update({ status: parsed.data.status }).eq("id", parsed.data.id).select("id");
  if (error || !data?.length) return dbError(t, error, t.errors.notFound);
  revalidatePath(`/admin/opportunities/${parsed.data.id}`);
  revalidatePath("/admin/opportunities");
  return ok(t.msg.statusUpdated);
}

/** Admin-only: share an approved opportunity with the chosen investor organizations. */
export async function shareOpportunity(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(["yv_admin"]);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("id"));
  const orgIds = z.array(z.uuid()).min(1).safeParse(fd.getAll("org_ids").map(String));
  if (!id.success) return fail(t.validation.missingRecord);
  if (!orgIds.success) return fail(t.validation.selectOrgs);
  const supabase = await createClient();
  const { data: opp, error: readError } = await supabase.from("investment_opportunities").select("status, title").eq("id", id.data).single();
  if (readError || !opp) return dbError(t, readError, t.errors.notFound);
  if (!["approved", "shared", "paused"].includes(opp.status)) return fail(t.validation.approveFirst);

  const { error } = await supabase.from("opportunity_access").upsert(
    orgIds.data.map((org) => ({ opportunity_id: id.data, investor_org_id: org, granted_by: user.id })),
    { onConflict: "opportunity_id,investor_org_id", ignoreDuplicates: true },
  );
  if (error) return dbError(t, error);
  if (opp.status !== "shared") {
    const { error: statusError } = await supabase.from("investment_opportunities").update({ status: "shared" }).eq("id", id.data);
    if (statusError) return dbError(t, statusError);
  }
  await Promise.all(orgIds.data.map((org) => notifyOrg(supabase, org, "opportunity_shared", `/investor/opportunities/${id.data}`, { title: opp.title })));
  revalidatePath(`/admin/opportunities/${id.data}`);
  return ok(fmt(t.msg.sharedWith, { n: orgIds.data.length }));
}

export async function revokeAccess(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["yv_admin"]);
  const t = await getDictionary();
  const parsed = z.object({ id: z.uuid(), org: z.uuid() }).safeParse({ id: fd.get("id"), org: fd.get("org") });
  if (!parsed.success) return fail(t.validation.missingRecord);
  const supabase = await createClient();
  const { error } = await supabase.from("opportunity_access").delete().eq("opportunity_id", parsed.data.id).eq("investor_org_id", parsed.data.org);
  if (error) return dbError(t, error);
  revalidatePath(`/admin/opportunities/${parsed.data.id}`);
  return ok(t.msg.accessRevoked);
}

const documentLink = z.object({ id: z.uuid(), document_id: z.uuid() });

export async function attachDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = documentLink.safeParse({ id: fd.get("id"), document_id: fd.get("document_id") });
  if (!parsed.success) return fail(t.validation.pickDocument);
  const supabase = await createClient();
  const { error } = await supabase
    .from("opportunity_documents")
    .insert({ opportunity_id: parsed.data.id, document_id: parsed.data.document_id, added_by: user.id });
  if (error) return dbError(t, error);
  await audit(supabase, "opportunity.document_shared", "opportunity", parsed.data.id, { document_id: parsed.data.document_id });
  revalidatePath(`/admin/opportunities/${parsed.data.id}`);
  return ok(t.msg.docAdded);
}

export async function detachDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = documentLink.safeParse({ id: fd.get("id"), document_id: fd.get("document_id") });
  if (!parsed.success) return fail(t.validation.missingRecord);
  const supabase = await createClient();
  const { error } = await supabase.from("opportunity_documents").delete().eq("opportunity_id", parsed.data.id).eq("document_id", parsed.data.document_id);
  if (error) return dbError(t, error);
  await audit(supabase, "opportunity.document_removed", "opportunity", parsed.data.id, { document_id: parsed.data.document_id });
  revalidatePath(`/admin/opportunities/${parsed.data.id}`);
  return ok(t.msg.docRemoved);
}
