"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { dbError, fail, logServerError, ok, type ActionState } from "@/lib/action-state";
import { str } from "@/lib/format";
import { notifyOrg } from "@/lib/notify";

/** Forwards an investor question to the founders WITHOUT revealing which investor asked. */
export async function routeToStartup(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("dd_request_id"));
  const title = str(fd.get("title"));
  if (!id.success || !title) return fail(t.validation.requestTitle);
  const supabase = await createClient();
  const { data: question, error: readError } = await supabase
    .from("due_diligence_requests")
    .select("id, investment_opportunities(startup_id, startups(org_id))")
    .eq("id", id.data)
    .single();
  const opp = question?.investment_opportunities;
  if (readError || !opp) return dbError(t, readError, t.errors.notFound);

  const { error } = await supabase.from("startup_requests").insert({
    startup_id: opp.startup_id,
    dd_request_id: id.data,
    title,
    body: str(fd.get("body")),
    due_date: str(fd.get("due_date")),
    created_by: user.id,
  });
  if (error) return dbError(t, error);
  const { error: statusError } = await supabase.from("due_diligence_requests").update({ status: "with_startup", assigned_to: user.id }).eq("id", id.data);
  if (statusError) return dbError(t, statusError);
  if (opp.startups) await notifyOrg(supabase, opp.startups.org_id, "new_request", "/startup/requests", { title });
  revalidatePath("/admin/diligence");
  return ok(t.msg.routed);
}

/** Drafts an answer for the investor. Nothing is visible to the investor until it is released. */
export async function draftResponse(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("request_id"));
  const body = str(fd.get("body"));
  if (!id.success || !body) return fail(t.validation.writeAnswer);
  const docId = z.uuid().safeParse(fd.get("document_id"));
  const release = fd.get("release") === "on";
  const supabase = await createClient();
  const { error } = await supabase.from("due_diligence_responses").insert({
    request_id: id.data,
    body,
    document_id: docId.success ? docId.data : null,
    approved_for_release: release,
    author_id: user.id,
  });
  if (error) return dbError(t, error);
  if (release) {
    await publishToInvestor(supabase, id.data);
  } else {
    const { error: statusError } = await supabase.from("due_diligence_requests").update({ status: "answered" }).eq("id", id.data);
    if (statusError) return dbError(t, statusError);
  }
  revalidatePath("/admin/diligence");
  return ok(release ? t.msg.answerReleased : t.msg.draftSaved);
}

export async function releaseResponse(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail(t.validation.missingRecord);
  const supabase = await createClient();
  const { data, error } = await supabase.from("due_diligence_responses").update({ approved_for_release: true }).eq("id", id.data).select("request_id").single();
  if (error || !data) return dbError(t, error, t.errors.notFound);
  await publishToInvestor(supabase, data.request_id);
  revalidatePath("/admin/diligence");
  return ok(t.msg.releasedLogged);
}

export async function closeQuestion(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail(t.validation.missingRecord);
  const supabase = await createClient();
  const { error } = await supabase.from("due_diligence_requests").update({ status: "closed" }).eq("id", id.data);
  if (error) return dbError(t, error);
  revalidatePath("/admin/diligence");
  return ok(t.msg.closed);
}

/**
 * After release: notify the asking investor, and place any attached document in the opportunity's
 * data room so the investor can actually open it (document access is granted per opportunity).
 */
async function publishToInvestor(supabase: ServerClient, requestId: string): Promise<void> {
  const { data: question, error } = await supabase.from("due_diligence_requests").select("investor_org_id, opportunity_id").eq("id", requestId).single();
  if (error || !question) return logServerError("diligence.publish", error);

  const { data: docs, error: docsError } = await supabase
    .from("due_diligence_responses")
    .select("document_id")
    .eq("request_id", requestId)
    .eq("approved_for_release", true)
    .not("document_id", "is", null);
  if (docsError) logServerError("diligence.documents", docsError);

  const rows = (docs ?? []).flatMap((d) => (d.document_id ? [{ opportunity_id: question.opportunity_id, document_id: d.document_id }] : []));
  if (rows.length) {
    const { error: attachError } = await supabase
      .from("opportunity_documents")
      .upsert(rows, { onConflict: "opportunity_id,document_id", ignoreDuplicates: true });
    if (attachError) logServerError("diligence.attach", attachError);
  }
  await notifyOrg(supabase, question.investor_org_id, "question_answered", `/investor/opportunities/${question.opportunity_id}`);
}
