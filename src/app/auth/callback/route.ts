import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/lib/safe-path";

const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;

/** Completes Google/Apple/Microsoft, sign-up confirmation, magic-link, invitation and recovery sign-ins. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const type = OTP_TYPES.find((t) => t === rawType);
  const next = safeRelativePath(url.searchParams.get("next")) ?? "/";

  const supabase = await createClient();
  let failed = true;
  if (code) {
    failed = !!(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    failed = !!(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  // Google/Apple/Microsoft report a refused or failed sign-in with an `error` parameter.
  if (failed) return NextResponse.redirect(new URL(url.searchParams.has("error") ? "/login?error=provider" : "/login?error=link", url.origin));

  const dest = type === "invite" || type === "recovery" ? "/auth/set-password" : next;
  return NextResponse.redirect(new URL(dest, url.origin));
}
