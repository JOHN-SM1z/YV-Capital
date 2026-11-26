"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, requireUser, type UserType } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { dbError, fail, logServerError, ok, type ActionState } from "@/lib/action-state";
import { str } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import type { Database } from "@/lib/database.types";

type OrgType = Database["public"]["Enums"]["org_type"];

const TYPE_FOR_ORG: Record<OrgType, readonly UserType[]> = { yv: ["yv_admin", "yv_team"], investor: ["investor"], startup: ["founder"] };

function revalidateTeams() {
  revalidatePath("/admin/team");
  revalidatePath("/admin/investors", "layout");
  revalidatePath("/admin/startups", "layout");
  revalidatePath("/investor/organization");
  revalidatePath("/startup/team");
}

/**
 * Invites a user into an organization.
 * - YV admins: any organization and user type (the type must match the organization).
 * - Investor / startup org admins: only their own organization, only as investor / founder.
 */
export async function inviteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["yv_admin", "investor", "founder"]);
  const t = await getDictionary();
  const parsed = z
    .object({ email: z.email(), full_name: z.string().min(1).max(200), org_id: z.uuid(), user_type: z.enum(["yv_admin", "yv_team", "investor", "founder"]) })
    .safeParse({
      email: str(fd.get("email"))?.toLowerCase(),
      full_name: str(fd.get("full_name")),
      // Non-admins can only invite into their own organization with their own role.
      org_id: isAdmin(me) ? fd.get("org_id") : me.orgId,
      user_type: isAdmin(me) ? fd.get("user_type") : me.userType,
    });
  if (!parsed.success) return fail(t.validation.inviteFields);
  const { email, full_name, org_id, user_type } = parsed.data;
  if (!isAdmin(me) && !me.isOrgAdmin) return fail(t.validation.inviteOnlyAdmin);

  const supabase = await createClient();
  const { data: org, error: orgError } = await supabase.from("organizations").select("id, type").eq("id", org_id).single();
  if (orgError || !org) return dbError(t, orgError, t.errors.notFound);
  if (!TYPE_FOR_ORG[org.type].includes(user_type)) return fail(t.validation.roleMismatch);

  const admin = createAdminClient();
  if (!admin) return fail(t.errors.invitesNotConnected);

  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${await siteUrl()}/auth/callback`, data: { full_name } });
  if (error || !invited.user) {
    if (error?.code === "email_exists") return fail(t.validation.userExists);
    logServerError("team.invite", error);
    return fail(t.validation.inviteFailed);
  }

  const userId = invited.user.id;
  const profile = await admin.from("user_profiles").insert({ id: userId, email, full_name, user_type });
  const membership = profile.error
    ? null
    : await admin.from("organization_members").insert({ org_id, user_id: userId, is_org_admin: isAdmin(me) && fd.get("is_org_admin") === "on" });
  if (profile.error || membership?.error) {
    // Roll back the auth account so the same email can be invited again.
    const { error: cleanupError } = await admin.auth.admin.deleteUser(userId);
    if (cleanupError) logServerError("team.invite-rollback", cleanupError);
    return dbError(t, profile.error ?? membership?.error, t.validation.membershipFailed);
  }
  const { error: auditError } = await admin
    .from("audit_logs")
    .insert({ actor_id: me.id, action: "member.invited", entity_type: "organization", entity_id: org_id, details: { user_type } });
  if (auditError) logServerError("team.audit", auditError);
  revalidateTeams();
  return ok(fmt(t.msg.invited, { email }));
}

/** Deactivates or reactivates a member. RLS allows YV admins (anyone) and org admins (own org, not self). */
export async function setMemberActive(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["yv_admin", "investor", "founder"]);
  const t = await getDictionary();
  const id = z.uuid().safeParse(fd.get("member_id"));
  if (!id.success) return fail(t.validation.missingRecord);
  const active = fd.get("active") === "true";
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_members").update({ is_active: active }).eq("id", id.data).neq("user_id", me.id).select("id");
  if (error || !data?.length) return dbError(t, error, t.validation.cantChangeMember);
  revalidateTeams();
  return ok(active ? t.msg.accessRestored : t.msg.accessRemoved);
}

export async function markNotificationsRead(): Promise<void> {
  const me = await requireUser(["yv_admin", "yv_team", "investor", "founder"]);
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me.id).is("read_at", null);
  if (error) logServerError("notifications.read", error);
  revalidatePath("/", "layout");
}

export async function updateKpiTarget(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser(["yv_admin"]);
  const t = await getDictionary();
  const parsed = z
    .object({ key: z.string().min(1).max(60), target: z.coerce.number().int().min(0).max(1_000_000), owner_id: z.uuid().nullable() })
    .safeParse({ key: fd.get("key"), target: fd.get("target"), owner_id: str(fd.get("owner_id")) });
  if (!parsed.success) return fail(t.validation.validTarget);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program_kpi_targets")
    .update({ target: parsed.data.target, owner_id: parsed.data.owner_id })
    .eq("key", parsed.data.key)
    .select("key");
  if (error || !data?.length) return dbError(t, error, t.errors.notFound);
  revalidatePath("/admin");
  return ok(t.msg.targetUpdated);
}
