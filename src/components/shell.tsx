import Image from "next/image";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";
import type { Dictionary } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/config";
import { signOut } from "@/lib/actions/auth";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { LanguageSwitcher } from "@/components/language-switcher";

type Props = {
  user: SessionUser;
  nav: NavItem[];
  portalLabel: string;
  unread: number;
  t: Dictionary;
  locale: Locale;
  children: ReactNode;
};

export function AppShell({ user, nav, portalLabel, unread, t, locale, children }: Props) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-line bg-ink text-white lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Image src="/yv/logo-mark.png" alt="Yoshlar Ventures" width={28} height={28} priority />
              <div className="leading-tight">
                <p className="font-display text-sm font-semibold">Yoshlar Ventures</p>
                <p className="text-[11px] text-white/60">{portalLabel}</p>
              </div>
            </div>
            <div className="lg:hidden">
              <LanguageSwitcher locale={locale} label={t.common.language} />
            </div>
          </div>
          <NavLinks items={nav} unread={unread} />
          <div className="mt-auto hidden space-y-3 border-t border-white/10 px-5 py-4 lg:block">
            <LanguageSwitcher locale={locale} label={t.common.language} />
            <div>
              <p className="truncate text-sm font-medium">{user.fullName || user.email}</p>
              <p className="truncate text-xs text-white/60">
                {t.roles[user.userType]} · {user.orgName}
              </p>
            </div>
            <form action={signOut}>
              <button className="text-xs text-white/70 hover:text-white">{t.common.signOut}</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
        <form action={signOut} className="mt-10 text-center lg:hidden">
          <button className="text-sm text-muted hover:text-ink">
            {t.common.signOut} ({user.email})
          </button>
        </form>
      </main>
    </div>
  );
}
