"use client";

import { useClientStrings } from "@/i18n/client";

export function PageSkeleton() {
  const { loading } = useClientStrings();
  return (
    <div className="animate-pulse space-y-4 p-2" aria-busy="true" aria-label={loading}>
      <div className="h-7 w-64 rounded bg-line" />
      <div className="h-4 w-96 max-w-full rounded bg-line/70" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-xl bg-line/60" />
        <div className="h-24 rounded-xl bg-line/60" />
        <div className="h-24 rounded-xl bg-line/60" />
      </div>
      <div className="h-64 rounded-xl bg-line/50" />
    </div>
  );
}
