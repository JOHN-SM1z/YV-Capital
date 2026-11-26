import { AppShell } from "@/components/shell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/data";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export default async function StartupLayout({ children }: LayoutProps<"/startup">) {
  const user = await requireUser(["founder"]);
  const supabase = await createClient();
  const [unread, openRequests, { t, locale }] = await Promise.all([
    getUnreadCount(supabase, user.id),
    supabase.from("startup_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    getI18n(),
  ]);
  const open = openRequests.count ?? 0;
  return (
    <AppShell
      user={user}
      portalLabel={t.portals.startup}
      unread={unread}
      t={t}
      locale={locale}
      nav={[
        { href: "/startup", label: t.nav.overview, exact: true },
        { href: "/startup/profile", label: t.nav.company },
        { href: "/startup/documents", label: t.nav.documents },
        { href: "/startup/requests", label: open ? fmt(t.nav.requestsCount, { n: open }) : t.nav.requests },
        { href: "/startup/meetings", label: t.nav.meetingsShort },
        { href: "/startup/notifications", label: t.nav.notifications, badgeKey: "unread" },
        { href: "/startup/team", label: t.nav.teamAccess },
      ]}
    >
      {children}
    </AppShell>
  );
}
