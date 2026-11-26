"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, homeFor } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";
import { fail, logServerError, ok, type ActionState } from "@/lib/action-state";
import { siteUrl } from "@/lib/site-url";
import { safeRelativePath } from "@/lib/safe-path";

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getDictionary();
  const parsed = z
    .object({ email: z.email(), password: z.string().min(1).max(200) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fail(t.auth.errEnterCredentials);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(error.status === 429 ? t.auth.errTooMany : t.auth.errWrongCredentials);

  const user = await getSessionUser();
  if (!user) {
    await supabase.auth.signOut();
    return fail(t.auth.errInactive);
  }
  redirect(safeRelativePath(formData.get("next")) ?? homeFor(user.userType));
}

export async function sendMagicLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getDictionary();
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return fail(t.auth.errEmail);
  const supabase = await createClient();
  // shouldCreateUser: false keeps the platform invitation-only.
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${await siteUrl()}/auth/callback` },
  });
  // "User not found" is expected for unknown emails; anything else is worth logging.
  if (error && error.status !== 400 && error.status !== 422) logServerError("auth.magic-link", error);
  // Same message either way, so the form can't be used to discover which emails have accounts.
  return ok(t.auth.magicLinkSent);
}

export async function setPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getDictionary();
  const pw = String(formData.get("password") ?? "");
  if (pw.length < 12) return fail(t.auth.errPasswordShort);
  if (pw !== formData.get("confirm")) return fail(t.auth.errPasswordMismatch);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return fail(error.code === "weak_password" ? t.auth.errPasswordWeak : t.auth.errPasswordFailed);
  const user = await getSessionUser();
  redirect(user ? homeFor(user.userType) : "/login");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
