import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, hasAuthSession, homeFor } from "@/lib/auth";
import { sendMagicLink, signIn } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AuthLayout } from "@/components/auth-layout";
import { OAuthButtons } from "@/components/oauth-buttons";
import { Field, Input } from "@/components/ui";
import { safeRelativePath } from "@/lib/safe-path";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getDictionary()).auth.signIn };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.userType));
  // Signed in without access yet (pending approval or deactivated).
  if (await hasAuthSession()) redirect("/pending");
  const { next, error } = await searchParams;
  const nextPath = safeRelativePath(typeof next === "string" ? next : null) ?? undefined;
  const t = await getDictionary();

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold">{t.auth.signIn}</h2>
      <p className="mt-1 text-sm text-muted">{t.auth.useInviteEmail}</p>
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-neg-50 px-3 py-2 text-sm text-neg">
          {error === "provider" ? t.access.providerFailed : t.auth.linkInvalid}
        </p>
      )}

      <div className="mt-6">
        <OAuthButtons next={nextPath} />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> {t.auth.or} <span className="h-px flex-1 bg-line" />
      </div>

      <ActionForm action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={nextPath ?? ""} />
        <Field label={t.common.email}>
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={t.auth.password}>
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" pendingLabel={t.auth.signingIn}>
          {t.auth.signIn}
        </SubmitButton>
      </ActionForm>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted hover:text-ink">{t.auth.magicLinkLabel}</summary>
        <ActionForm action={sendMagicLink} className="mt-3 space-y-3">
          <Input name="email" type="email" autoComplete="email" placeholder="you@fund.com" required aria-label={t.common.email} />
          <SubmitButton variant="secondary" className="w-full" pendingLabel={t.auth.sending}>
            {t.auth.sendLink}
          </SubmitButton>
        </ActionForm>
      </details>

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-muted">
        {t.access.noAccount}{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          {t.access.requestAccess}
        </Link>
      </p>
    </AuthLayout>
  );
}
