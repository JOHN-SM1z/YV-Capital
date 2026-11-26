"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser, STAFF } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { dbError, fail, ok, type ActionState } from "@/lib/action-state";
import { str } from "@/lib/format";
import { tashkentToIso } from "@/lib/time";
import { notifyOrg } from "@/lib/notify";
import { Constants } from "@/lib/database.types";

const E = Constants.public.Enums;

function optUuid(v: FormDataEntryValue | null): string | null {
  const parsed = z.uuid().safeParse(v);
  return parsed.success ? parsed.data : null;
}

export async function createMeeting(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const title = str(fd.get("title"));
  if (!title) return fail(t.validation.meetingTitle);
  const startsAt = tashkentToIso(str(fd.get("starts_at")));
  if (startsAt === "invalid") return fail(t.validation.invalidDate);
  const duration = Number.parseInt(String(fd.get("duration_min") ?? "30"), 10);
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").insert({
    title,
    starts_at: startsAt,
    duration_min: Number.isFinite(duration) ? Math.min(480, Math.max(5, duration)) : 30,
    location: str(fd.get("location")),
    agenda: str(fd.get("agenda")),
    status: "scheduled",
    investor_org_id: optUuid(fd.get("investor_org_id")),
    startup_id: optUuid(fd.get("startup_id")),
    opportunity_id: optUuid(fd.get("opportunity_id")),
    visible_to_investor: fd.get("visible_to_investor") === "on",
    visible_to_startup: fd.get("visible_to_startup") === "on",
    owner_id: user.id,
  });
  if (error) return dbError(t, error);
  revalidatePath("/admin/meetings");
  return ok(t.msg.meetingCreated);
}

export async function updateMeeting(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const t = await getDictionary();
  const parsed = z.object({ id: z.uuid(), status: z.enum(E.meeting_status) }).safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return fail(t.validation.pickStatus);
  const startsAt = tashkentToIso(str(fd.get("starts_at")));
  if (startsAt === "invalid") return fail(t.validation.invalidDate);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .update({ status: parsed.data.status, ...(startsAt ? { starts_at: startsAt } : {}) })
    .eq("id", parsed.data.id)
    .select("investor_org_id, visible_to_investor, title")
    .single();
  if (error || !data) return dbError(t, error, t.errors.notFound);
  const { status } = parsed.data;
  if (data.investor_org_id && data.visible_to_investor && (status === "scheduled" || status === "cancelled")) {
    await notifyOrg(supabase, data.investor_org_id, status === "scheduled" ? "meeting_confirmed" : "meeting_cancelled", "/investor/meetings", {
      title: data.title,
    });
  }
  revalidatePath("/admin/meetings");
  return ok(t.msg.meetingUpdated);
}

export async function saveMeetingNotes(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("meeting_id"));
  if (!id.success) return fail(t.validation.missingRecord);
  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_notes")
    .upsert({ meeting_id: id.data, notes: str(fd.get("notes")), outcome: str(fd.get("outcome")), updated_by: user.id });
  if (error) return dbError(t, error);
  revalidatePath("/admin/meetings");
  return ok(t.msg.meetingNotesSaved);
}

export async function createFollowUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  const t = await getDictionary();
  const title = str(fd.get("title"));
  if (!title) return fail(t.validation.writeFollowUp);
  const priority = z.enum(E.priority_level).catch("medium").parse(fd.get("priority"));
  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").insert({
    title,
    description: str(fd.get("description")),
    due_date: str(fd.get("due_date")),
    priority,
    investor_id: optUuid(fd.get("investor_id")),
    startup_id: optUuid(fd.get("startup_id")),
    opportunity_id: optUuid(fd.get("opportunity_id")),
    assigned_to: optUuid(fd.get("assigned_to")) ?? user.id,
    created_by: user.id,
  });
  if (error) return dbError(t, error);
  revalidatePath("/admin", "layout");
  return ok(t.msg.followUpAdded);
}

export async function toggleFollowUp(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(STAFF);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail(t.validation.missingRecord);
  const done = fd.get("done") === "true";
  const supabase = await createClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({ is_done: done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", id.data);
  if (error) return dbError(t, error);
  revalidatePath("/admin", "layout");
  return ok();
}
