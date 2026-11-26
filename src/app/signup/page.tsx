import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, hasAuthSession, homeFor } from "@/lib/auth";
import { signUp } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AuthLayout } from "@/components/auth-layout";
import { OAuthButtons } from "@/components/oauth-buttons";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getDictionary()).access.signUpTitle };
}

/** Self-service sign-up. Every new account waits for YV approval before it sees anything. */
export default async function SignUpPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.userType));
  if (await hasAuthSession()) redirect("/pending");
  const t = await getDictionary();
  const a = t.access;

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold">{a.signUpTitle}</h2>
      <p className="mt-1 text-sm text-muted">{a.signUpSub}</p>

      <div className="mt-6">
        <OAuthButtons />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> {t.auth.or} <span className="h-px flex-1 bg-line" />
      </div>

      <ActionForm action={signUp} className="space-y-4">
        <Field label={a.fullName}>
          <Input name="full_name" autoComplete="name" required minLength={2} maxLength={200} />
        </Field>
        <Field label={t.common.email}>
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={t.auth.password} hint={t.auth.errPasswordShort}>
          <Input name="password" type="password" autoComplete="new-password" minLength={12} required />
        </Field>
        <Field label={t.auth.confirmPassword}>
          <Input name="confirm" type="password" autoComplete="new-password" minLength={12} required />
        </Field>
        <Field label={a.iAm}>
          <Select name="requested_role" required defaultValue="investor">
            <option value="investor">{a.roleInvestor}</option>
            <option value="founder">{a.roleFounder}</option>
          </Select>
        </Field>
        <Field label={a.organization}>
          <Input name="organization_name" autoComplete="organization" required minLength={2} maxLength={200} />
        </Field>
        <Field label={a.message}>
          <Textarea name="message" maxLength={1000} className="min-h-20" placeholder={a.messagePh} />
        </Field>
        <SubmitButton className="w-full" pendingLabel={a.creating}>
          {a.create}
        </SubmitButton>
      </ActionForm>

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-muted">
        {a.haveAccount}{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          {t.auth.signIn}
        </Link>
      </p>
    </AuthLayout>
  );
}
