import { AppShell } from "@/components/shell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/data";
import { getI18n } from "@/i18n/server";

export default async function InvestorLayout({ children }: LayoutProps<"/investor">) {
  const user = await requireUser(["investor"]);
  const supabase = await createClient();
  const [unread, { t, locale }] = await Promise.all([getUnreadCount(supabase, user.id), getI18n()]);
  return (
    <AppShell
      user={user}
      portalLabel={t.portals.investor}
      unread={unread}
      t={t}
      locale={locale}
      nav={[
        { href: "/investor", label: t.nav.overview, exact: true },
        { href: "/investor/opportunities", label: t.nav.opportunities },
        { href: "/investor/portfolio", label: t.nav.portfolio },
        { href: "/investor/meetings", label: t.nav.meetingsShort },
        { href: "/investor/notifications", label: t.nav.notifications, badgeKey: "unread" },
        { href: "/investor/organization", label: t.nav.organization },
      ]}
    >
      {children}
    </AppShell>
  );
}
