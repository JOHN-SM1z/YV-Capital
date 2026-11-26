import Link from "next/link";
import { getDictionary } from "@/i18n/server";

export default async function NotFound() {
  const t = await getDictionary();
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">{t.states.notFoundTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.states.notFoundBody}</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand-600">
        {t.states.goHome}
      </Link>
    </div>
  );
}
