import { INTL_LOCALE, type Locale } from "@/i18n/config";

export function usd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString("en-US")}`;
}

export function usdRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return "—";
  if (min == null) return `≤ ${usd(max)}`;
  if (max == null) return `${usd(min)}+`;
  return `${usd(min)} – ${usd(max)}`;
}

export function date(d: string | null | undefined, locale: Locale): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Tashkent" });
}

/** Meetings are always shown in Tashkent time (UTC+5, no DST). */
export function dateTime(d: string | null | undefined, locale: Locale): string {
  if (!d) return "—";
  const s = new Date(d).toLocaleString(INTL_LOCALE[locale], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
  return `${s} (UTC+5)`;
}

export function metricValue(value: number, unit: string): string {
  if (unit === "USD") return usd(value);
  if (unit.startsWith("%")) return `${value}${unit}`;
  return `${value.toLocaleString("en-US")}${unit === "count" ? "" : ` ${unit}`}`;
}

export function bytes(n: number): string {
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/**
 * Parses an optional money input like "150000", "150k", "1.5m" or "$1,200".
 * Returns null for blank input and NaN for anything unparseable (callers must reject NaN).
 */
export function parseMoney(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[$,\s]/g, "");
  if (!s) return null;
  const [, digits, suffix] = s.match(/^(\d+(?:\.\d+)?)([km])?$/) ?? [];
  if (!digits) return Number.NaN;
  const n = Number(digits) * (suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1);
  return Math.round(n);
}

/** Trimmed form value, or null when blank. */
export function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

/** Epoch ms for N days ago (request-time helper for server components). */
export const daysAgoMs = (n: number) => Date.now() - n * 864e5;

/** Today's date (YYYY-MM-DD) in Tashkent, for due-date comparisons. */
export const todayTashkent = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
