/**
 * Converts a `datetime-local` value entered in Tashkent time (UTC+5, no daylight saving) to an ISO
 * timestamp. Returns null for blank input and "invalid" when the value is not a real date/time.
 */
export function tashkentToIso(value: string | null): string | null | "invalid" {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "invalid";
  const d = new Date(`${value}:00+05:00`);
  if (Number.isNaN(d.getTime())) return "invalid";
  // Reject roll-overs such as 2026-02-30, which Date silently turns into March.
  const roundTrip = new Date(d.getTime() + 5 * 3600e3).toISOString().slice(0, 16);
  return roundTrip === value ? d.toISOString() : "invalid";
}
