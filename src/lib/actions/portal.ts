"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { dbError, fail, logServerError, ok, type ActionState } from "@/lib/action-state";
import { parseMoney, str } from "@/lib/format";
import { DOC_TYPES } from "@/lib/labels";
import { safeFileName, validateUpload } from "@/lib/uploads";

const BUCKET = "startup-documents";

// ───────────── investor actions ─────────────
// The investor organization always comes from the server-side session, never from the form.

export async function expressInterest(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["investor"]);
  const t = await getDictionary();
  const opp = z.uuid().safeParse(fd.get("opportunity_id"));
  const level = z.enum(["interested", "info_requested", "indicative", "declined"]).safeParse(fd.get("level"));
  if (!opp.success || !level.success) return fail(t.validation.chooseInterest);
  const amount = parseMoney(fd.get("indicative_amount"));
  if (Number.isNaN(amount)) return fail(t.errors.amount);
  const supabase = await createClient();
  const { error } = await supabase.from("investor_interests").upsert(
    {
      opportunity_id: opp.data,
      investor_org_id: me.orgId,
      level: level.data,
      indicative_amount: level.data === "declined" ? null : amount,
      note: str(fd.get("note")),
      submitted_by: me.id,
    },
    { onConflict: "opportunity_id,investor_org_id" },
  );
  if (error) return dbError(t, error, t.errors.notAvailable);
  revalidatePath(`/investor/opportunities/${opp.data}`);
  return ok(t.msg.interestSent);
}

export async function askQuestion(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["investor"]);
  const t = await getDictionary();
  const opp = z.uuid().safeParse(fd.get("opportunity_id"));
  const question = str(fd.get("question"));
  if (!opp.success || !question) return fail(t.validation.writeQuestion);
  if (question.length > 4000) return fail(t.validation.questionLength);
  const supabase = await createClient();
  const { error } = await supabase
    .from("due_diligence_requests")
    .insert({ opportunity_id: opp.data, investor_org_id: me.orgId, question, asked_by: me.id, status: "open" });
  if (error) return dbError(t, error, t.errors.notAvailable);
  revalidatePath(`/investor/opportunities/${opp.data}`);
  return ok(t.msg.questionSent);
}

export async function requestMeeting(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["investor"]);
  const t = await getDictionary();
  const opp = z.uuid().safeParse(fd.get("opportunity_id"));
  const topic = str(fd.get("topic"));
  if (!topic) return fail(t.validation.meetingTopic);
  const availability = str(fd.get("availability"));
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").insert({
    title: topic.slice(0, 200),
    // Stored text is shown to YV staff as written by the investor.
    agenda: availability ? `${t.investorPortal.availability}: ${availability.slice(0, 500)}` : null,
    status: "requested",
    investor_org_id: me.orgId,
    opportunity_id: opp.success ? opp.data : null,
    visible_to_investor: true,
    requested_by: me.id,
  });
  if (error) return dbError(t, error);
  revalidatePath("/investor/meetings");
  if (opp.success) revalidatePath(`/investor/opportunities/${opp.data}`);
  return ok(t.msg.meetingRequested);
}

// ───────────── founder actions ─────────────

export async function respondToRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["founder"]);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("request_id"));
  const body = str(fd.get("body"));
  if (!id.success || !body) return fail(t.validation.writeResponse);
  const docId = z.uuid().safeParse(fd.get("document_id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("startup_request_responses")
    .insert({ request_id: id.data, body, document_id: docId.success ? docId.data : null, author_id: me.id });
  if (error) return dbError(t, error);
  const { error: statusError } = await supabase.from("startup_requests").update({ status: "answered" }).eq("id", id.data);
  if (statusError) return dbError(t, statusError);
  revalidatePath("/startup", "layout");
  return ok(t.msg.responseSent);
}

/**
 * Registers a file the browser already uploaded straight to private storage (path
 * '<startup_id>/<uuid>-<name>', enforced by storage RLS). The real content is re-validated on the
 * server; anything that fails is deleted.
 */
export async function registerDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["founder"]);
  const t = await getDictionary();
  const supabase = await createClient();
  const { data: startup, error: startupError } = await supabase.from("startups").select("id").eq("org_id", me.orgId).single();
  if (startupError || !startup) return dbError(t, startupError, t.validation.companyNotFound);

  const path = String(fd.get("storage_path") ?? "");
  const title = str(fd.get("title"));
  const docType = z.enum(DOC_TYPES).safeParse(fd.get("doc_type"));
  const segments = path.split("/");
  const [folder, file] = segments;
  if (segments.length !== 2 || folder !== startup.id || !file || !docType.success || !title) return fail(t.validation.invalidUpload);

  const removeUpload = async () => {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([path]);
    if (removeError) logServerError("upload.cleanup", removeError);
  };

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
  if (downloadError || !blob) return fail(t.validation.uploadMissing);
  const head = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
  const check = validateUpload({ name: file.replace(/^[0-9a-f-]{36}-/, ""), size: blob.size, head });
  if (!check.ok) {
    await removeUpload();
    return fail(t.upload[check.error]);
  }

  const { error } = await supabase.from("startup_documents").insert({
    startup_id: startup.id,
    doc_type: docType.data,
    title,
    storage_path: path,
    mime_type: check.mime,
    size_bytes: blob.size,
    status: "submitted",
    classification: "confidential",
    uploaded_by: me.id,
  });
  if (error) {
    await removeUpload();
    return dbError(t, error);
  }
  revalidatePath("/startup", "layout");
  return ok(t.msg.uploaded);
}

export async function newUploadPath(name: string): Promise<{ path?: string; error?: string }> {
  const me = await requireUser(["founder"]);
  const t = await getDictionary();
  const supabase = await createClient();
  const { data: startup, error } = await supabase.from("startups").select("id").eq("org_id", me.orgId).single();
  if (error || !startup) {
    logServerError("upload.path", error);
    return { error: t.validation.companyNotFound };
  }
  return { path: `${startup.id}/${crypto.randomUUID()}-${safeFileName(name)}` };
}
