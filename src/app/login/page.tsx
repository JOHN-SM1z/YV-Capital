import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionUser, homeFor } from "@/lib/auth";
import { sendMagicLink, signIn } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Field, Input } from "@/components/ui";
import { getDictionary, getI18n } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getDictionary()).auth.signIn };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.userType));
  const { next, error } = await searchParams;
  const { t, locale } = await getI18n();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <Image src="/yv/logo-mark.png" alt="" width={36} height={36} priority />
          <span className="font-display text-lg font-semibold">Yoshlar Ventures</span>
        </div>
        <div className="max-w-md">
          <p className="text-sm font-medium tracking-wide text-brand uppercase">{t.auth.heroKicker}</p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold">{t.auth.heroTitle}</h1>
          <p className="mt-4 text-white/70">{t.auth.heroBody}</p>
        </div>
        <p className="text-xs text-white/40">© Yoshlar Ventures · Tashkent</p>
      </section>

      <section className="flex flex-col px-6 py-8">
        <div className="flex justify-end">
          <LanguageSwitcher locale={locale} label={t.common.language} tone="light" />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Image src="/yv/logo-mark.png" alt="" width={28} height={28} />
            <span className="font-display font-semibold">Yoshlar Ventures</span>
          </div>
          <h2 className="text-2xl font-semibold">{t.auth.signIn}</h2>
          <p className="mt-1 text-sm text-muted">{t.auth.useInviteEmail}</p>
          {error && <p className="mt-4 rounded-md bg-neg-50 px-3 py-2 text-sm text-neg">{t.auth.linkInvalid}</p>}

          <ActionForm action={signIn} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
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

          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> {t.auth.or} <span className="h-px flex-1 bg-line" />
          </div>

          <ActionForm action={sendMagicLink} className="space-y-3">
            <Field label={t.auth.magicLinkLabel}>
              <Input name="email" type="email" autoComplete="email" placeholder="you@fund.com" required />
            </Field>
            <SubmitButton variant="secondary" className="w-full" pendingLabel={t.auth.sending}>
              {t.auth.sendLink}
            </SubmitButton>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
