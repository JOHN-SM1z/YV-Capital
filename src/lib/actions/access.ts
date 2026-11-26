"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { dbError, fail, ok, type ActionState } from "@/lib/action-state";
import { str } from "@/lib/format";
import { Constants } from "@/lib/database.types";

const USER_TYPES = Constants.public.Enums.user_type;

/**
 * Admin decisions on sign-ups and pre-approvals. Every rule (admin only, role must fit the
 * organization, pending requests only) is enforced again in the database functions.
 */
export async function approveAccessRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["yv_admin"]);
  const t = await getDictionary();
  const parsed = z
    .object({ user_id: z.uuid(), org_id: z.uuid(), user_type: z.enum(USER_TYPES) })
    .safeParse({ user_id: fd.get("user_id"), org_id: fd.get("org_id"), user_type: fd.get("user_type") });
  if (!parsed.success) return fail(t.access.errApproveFields);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_access_request", {
    p_user: parsed.data.user_id,
    p_org: parsed.data.org_id,
    p_type: parsed.data.user_type,
    p_org_admin: fd.get("is_org_admin") === "on",
  });
  if (error) return error.code === "23514" ? fail(t.validation.roleMismatch) : dbError(t, error);
  if (!data) return fail(t.access.errNotPending);
  revalidatePath("/admin/team");
  return ok(t.access.approved);
}

export async function declineAccessRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["yv_admin"]);
  const t = await getDictionary();
  const userId = z.uuid().safeParse(fd.get("user_id"));
  if (!userId.success) return fail(t.validation.missingRecord);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decline_access_request", { p_user: userId.data });
  if (error) return dbError(t, error);
  if (!data) return fail(t.access.errNotPending);
  revalidatePath("/admin/team");
  return ok(t.access.declined);
}

/** Pre-approve an email: whoever signs up with it (verified) gets this role in this organization. */
export async function addAccessGrant(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["yv_admin"]);
  const t = await getDictionary();
  const parsed = z.object({ email: z.email().max(254), org_id: z.uuid(), user_type: z.enum(USER_TYPES), full_name: z.string().max(200).nullable() }).safeParse({
    email: str(fd.get("email"))?.toLowerCase(),
    org_id: fd.get("org_id"),
    user_type: fd.get("user_type"),
    full_name: str(fd.get("full_name")),
  });
  if (!parsed.success) return fail(t.access.errGrantFields);
  const supabase = await createClient();
  const { error } = await supabase.from("access_grants").insert({ ...parsed.data, is_org_admin: fd.get("is_org_admin") === "on", granted_by: me.id });
  if (error) {
    if (error.code === "23514") return fail(t.validation.roleMismatch);
    if (error.code === "23505") return fail(t.access.errGrantExists);
    return dbError(t, error);
  }
  revalidatePath("/admin/team");
  return ok(fmt(t.access.grantAdded, { email: parsed.data.email }));
}

export async function revokeAccessGrant(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["yv_admin"]);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail(t.validation.missingRecord);
  const supabase = await createClient();
  const { data, error } = await supabase.from("access_grants").delete().eq("id", id.data).is("used_at", null).select("id");
  if (error) return dbError(t, error);
  if (!data?.length) return fail(t.errors.notFound);
  revalidatePath("/admin/team");
  return ok(t.access.grantRevoked);
}
