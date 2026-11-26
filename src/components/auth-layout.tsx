import Image from "next/image";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getI18n } from "@/i18n/server";

/** Two-column frame shared by sign-in, sign-up and the pending-approval page. */
export async function AuthLayout({ children }: { children: ReactNode }) {
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
          {children}
        </div>
      </section>
    </div>
  );
}
