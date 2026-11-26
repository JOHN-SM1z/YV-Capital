"use client";

import { useEffect } from "react";
import { useClientStrings } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useClientStrings();
  useEffect(() => {
    // The digest correlates with the server log; no user data is logged here.
    console.error("[yv:ui]", error.digest ?? error.message);
  }, [error]);
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">{t.errorTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.errorBody}</p>
      <button onClick={reset} className="mt-4 text-sm font-medium text-brand-600">
        {t.tryAgain}
      </button>
    </div>
  );
}
