"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, homeFor } from "@/lib/auth";
import { isOAuthProvider } from "@/lib/auth-providers";
import { str } from "@/lib/format";
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
  // Signed in but without access yet (pending, declined or deactivated): /pending explains which.
  if (!user) redirect("/pending");
  redirect(safeRelativePath(formData.get("next")) ?? homeFor(user.userType));
}

/**
 * Starts Google, Apple or Microsoft sign-in. The same flow signs up new people: their account stays
 * pending until YV approves it (or an admin pre-approved the verified email).
 */
export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = formData.get("provider");
  if (!isOAuthProvider(provider)) redirect("/login?error=provider");
  const next = safeRelativePath(formData.get("next"));
  const callback = new URL(`${await siteUrl()}/auth/callback`);
  if (next) callback.searchParams.set("next", next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    // Microsoft only returns the email address when asked for it.
    options: { redirectTo: callback.toString(), scopes: provider === "azure" ? "email openid profile" : undefined },
  });
  if (error || !data.url) {
    logServerError(`auth.oauth.${provider}`, error);
    redirect("/login?error=provider");
  }
  redirect(data.url);
}

const signUpSchema = z.object({
  full_name: z.string().min(2).max(200),
  email: z.email().max(254),
  password: z.string().min(12).max(200),
  requested_role: z.enum(["investor", "founder"]),
  organization_name: z.string().min(2).max(200),
  message: z.string().max(1000).nullable(),
});

/** Email sign-up. Creates a pending account; YV reviews it after the email is confirmed. */
export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getDictionary();
  const parsed = signUpSchema.safeParse({
    full_name: str(formData.get("full_name")),
    email: str(formData.get("email"))?.toLowerCase(),
    password: String(formData.get("password") ?? ""),
    requested_role: formData.get("requested_role"),
    organization_name: str(formData.get("organization_name")),
    message: str(formData.get("message")),
  });
  if (!parsed.success) {
    const pw = String(formData.get("password") ?? "");
    return fail(pw.length > 0 && pw.length < 12 ? t.auth.errPasswordShort : t.access.errSignUpFields);
  }
  if (formData.get("password") !== formData.get("confirm")) return fail(t.auth.errPasswordMismatch);
  const { email, password, ...meta } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    // Stored as request details only; metadata never grants a role (see the database trigger).
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback`, data: meta },
  });
  if (error) {
    if (error.code === "weak_password") return fail(t.auth.errPasswordWeak);
    if (error.status === 429) return fail(t.auth.errTooMany);
    logServerError("auth.signup", error);
    return fail(t.access.errSignUpFailed);
  }
  // Same message whether or not the email already had an account, so the form can't reveal it.
  return ok(t.access.checkEmail);
}

/** A pending applicant completes or edits their request (needed after Google/Apple/Microsoft sign-up). */
export async function submitAccessRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getDictionary();
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.userType));
  const parsed = z
    .object({
      full_name: z.string().min(2).max(200),
      requested_role: z.enum(["investor", "founder"]),
      organization_name: z.string().min(2).max(200),
      message: z.string().max(1000).nullable(),
    })
    .safeParse({
      full_name: str(formData.get("full_name")),
      requested_role: formData.get("requested_role"),
      organization_name: str(formData.get("organization_name")),
      message: str(formData.get("message")),
    });
  if (!parsed.success) return fail(t.access.errRequestFields);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_access_request", {
    p_role: parsed.data.requested_role,
    p_organization: parsed.data.organization_name,
    p_message: parsed.data.message ?? "",
    p_full_name: parsed.data.full_name,
  });
  if (error) {
    logServerError("auth.access-request", error);
    return fail(t.errors.generic);
  }
  if (!data) return fail(t.access.errNotPending);
  return ok(t.access.requestSaved);
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
