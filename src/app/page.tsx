import { redirect } from "next/navigation";
import { getSessionUser, homeFor } from "@/lib/auth";
import { signOut } from "@/lib/actions/auth";
import { getDictionary } from "@/i18n/server";

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.userType));
  const t = await getDictionary();
  // Signed in but without an active membership (for example, deactivated).
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">{t.states.inactiveTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.states.inactiveBody}</p>
      <form action={signOut} className="mt-4">
        <button className="text-sm font-medium text-brand-600">{t.common.signOut}</button>
      </form>
    </div>
  );
}
