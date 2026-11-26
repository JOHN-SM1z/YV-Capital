import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { markNotificationsRead } from "@/lib/actions/team";
import { Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { rows } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { isKeyOf } from "@/lib/labels";
import { safeRelativePath } from "@/lib/safe-path";
import type { Json } from "@/lib/database.types";

/** Only scalar string values of the stored params are interpolated. */
function stringParams(params: Json): Record<string, string> {
  if (!params || typeof params !== "object" || Array.isArray(params)) return {};
  return Object.fromEntries(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
}

export async function NotificationsList({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { t, locale } = await getI18n();
  const items = rows(
    await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    "notifications",
  );
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader
        title={t.notifications.title}
        description={unread ? fmt(t.notifications.unread, { n: unread }) : t.notifications.caughtUp}
        actions={
          unread > 0 && (
            <form action={markNotificationsRead}>
              <button className={buttonClass("secondary", "sm")}>{t.notifications.markAll}</button>
            </form>
          )
        }
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState title={t.notifications.none} />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const params = stringParams(n.params);
              // Older rows have no kind; show their stored text.
              const title = n.kind && isKeyOf(t.notif, n.kind) ? fmt(t.notif[n.kind], { org: params.org ?? "—", company: params.company ?? "—" }) : n.title;
              const detail = n.kind ? (params.title ?? null) : n.body;
              const href = safeRelativePath(n.link);
              return (
                <li key={n.id} className={`flex items-start gap-3 px-5 py-3 ${n.read_at ? "" : "bg-brand-50/40"}`}>
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link href={href} className="font-medium hover:underline">
                        {title}
                      </Link>
                    ) : (
                      <p className="font-medium">{title}</p>
                    )}
                    {detail && <p className="text-sm text-ink-2">{detail}</p>}
                    <p className="text-xs text-muted">{dateTime(n.created_at, locale)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
