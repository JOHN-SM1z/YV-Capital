import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type Tone } from "@/components/ui";
import { getDictionary } from "@/i18n/server";
import { reasonText } from "@/i18n/reason";
import type { MatchFit, MatchResult } from "@/lib/matching/types";

const FIT_TONE: Record<MatchFit, Tone> = { strong: "pos", possible: "info", weak: "neutral", none: "neg" };

export async function FitBadge({ fit }: { fit: MatchFit }) {
  const t = await getDictionary();
  return <Badge tone={FIT_TONE[fit]}>{t.enums.fit[fit]}</Badge>;
}

export async function MatchReasons({ reasons }: { reasons: MatchResult["reasons"] }) {
  const t = await getDictionary();
  return (
    <ul className="mt-1 space-y-0.5 text-xs">
      {reasons.map((r) => (
        <li key={r.code} className={r.kind === "pos" ? "text-pos" : r.kind === "neg" ? "text-neg" : "text-muted"}>
          <span aria-hidden>{r.kind === "pos" ? "✓ " : r.kind === "neg" ? "✕ " : "· "}</span>
          {reasonText(t, r)}
        </li>
      ))}
    </ul>
  );
}

export function MatchRow({ href, name, result, extra }: { href: string; name: string; result: MatchResult; extra?: ReactNode }) {
  return (
    <li className="flex items-start gap-4 px-5 py-3">
      <div className="tabular w-12 shrink-0 text-right font-display text-xl font-semibold">{result.score}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href} className="font-medium hover:underline">
            {name}
          </Link>
          <FitBadge fit={result.fit} />
          {extra}
        </div>
        <MatchReasons reasons={result.reasons} />
      </div>
    </li>
  );
}
