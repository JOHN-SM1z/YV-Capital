import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPassword } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getDictionary()).auth.setPasswordTitle };
}

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  const t = await getDictionary();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">{t.auth.setPasswordTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.auth.setPasswordBody}</p>
        <ActionForm action={setPassword} className="mt-6 space-y-4">
          <Field label={t.auth.newPassword}>
            <Input name="password" type="password" autoComplete="new-password" minLength={12} required />
          </Field>
          <Field label={t.auth.confirmPassword}>
            <Input name="confirm" type="password" autoComplete="new-password" minLength={12} required />
          </Field>
          <SubmitButton className="w-full">{t.auth.saveAndContinue}</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
