import { requireUser } from "@/lib/auth";
import { NotificationsList } from "@/components/notifications-list";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getI18n()).t.nav.notifications };
}

export default async function Page() {
  const me = await requireUser(["yv_admin", "yv_team"]);
  return <NotificationsList userId={me.id} />;
}
