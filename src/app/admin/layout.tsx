import { AppShell } from "@/components/shell";
import { requireUser, STAFF } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/data";
import type { NavItem } from "@/components/nav-links";
import { getI18n } from "@/i18n/server";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser(STAFF);
  const supabase = await createClient();
  const [unread, { t, locale }] = await Promise.all([getUnreadCount(supabase, user.id), getI18n()]);

  const nav: NavItem[] = [
    { href: "/admin", label: t.nav.overview, exact: true },
    { href: "/admin/startups", label: t.nav.startups },
    { href: "/admin/insights", label: t.nav.insights },
    { href: "/admin/investors", label: t.nav.investors },
    { href: "/admin/matching", label: t.nav.matching },
    { href: "/admin/opportunities", label: t.nav.opportunities },
    { href: "/admin/diligence", label: t.nav.diligence },
    { href: "/admin/meetings", label: t.nav.meetings },
    { href: "/admin/search", label: t.nav.search },
    { href: "/admin/notifications", label: t.nav.notifications, badgeKey: "unread" },
    ...(user.userType === "yv_admin"
      ? [
          { href: "/admin/team", label: t.nav.team },
          { href: "/admin/activity", label: t.nav.activity },
        ]
      : []),
  ];

  return (
    <AppShell user={user} nav={nav} portalLabel={t.portals.admin} unread={unread} t={t} locale={locale}>
      {children}
    </AppShell>
  );
}
