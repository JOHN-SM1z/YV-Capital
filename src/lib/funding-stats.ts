/**
 * Pure aggregations over sourced funding rounds (no I/O, unit-tested).
 * Amounts are disclosed amounts only: an undisclosed amount is never counted as zero or guessed.
 */

export const YV_NAME = "Yoshlar Ventures";

export type RoundLike = {
  startupId: string;
  announcedOn: string | null;
  amountUsd: number | null;
  roundType: string | null;
  participants: { name: string; amountUsd: number | null; isLead: boolean }[];
};

export type FundingSummary = {
  roundCount: number;
  /** Sum of disclosed round amounts; null when no round has a disclosed amount. */
  disclosedUsd: number | null;
  /** Rounds whose amount was not disclosed (shown, so the total is not mistaken for complete). */
  undisclosedCount: number;
  lastReportedOn: string | null;
};

export function summarizeRounds(rounds: Pick<RoundLike, "announcedOn" | "amountUsd">[]): FundingSummary {
  let disclosed: number | null = null;
  let undisclosed = 0;
  let last: string | null = null;
  for (const r of rounds) {
    if (r.amountUsd == null) undisclosed += 1;
    else disclosed = (disclosed ?? 0) + r.amountUsd;
    if (r.announcedOn && (last === null || r.announcedOn > last)) last = r.announcedOn;
  }
  return { roundCount: rounds.length, disclosedUsd: disclosed, undisclosedCount: undisclosed, lastReportedOn: last };
}

/** Case- and spacing-insensitive key, so "AloqaVentures" and "Aloqa Ventures" count as one fund. */
export function participantKey(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Keys under which an organization name can appear in sources: the full name, the part before a
 * bracket and the bracketed alias, so "Politecnico di Torino (Turin Polytechnic University)" matches
 * a source that says "Turin Polytechnic University".
 */
export function nameKeys(name: string): string[] {
  const keys = new Set([participantKey(name)]);
  const m = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m?.[1]) keys.add(participantKey(m[1]));
  if (m?.[2]) keys.add(participantKey(m[2]));
  keys.delete("");
  return [...keys];
}

export type CoInvestor = { name: string; roundsWithYv: number; companies: string[]; ledRounds: number };

/**
 * Who invests alongside YV: participants of rounds in which YV also took part, ranked by number of
 * shared rounds. YV itself is excluded. `companyName` maps a startup id to its display name.
 */
export function rankCoInvestors(rounds: RoundLike[], companyName: (startupId: string) => string): CoInvestor[] {
  const yvKey = participantKey(YV_NAME);
  const byKey = new Map<string, { name: string; rounds: number; led: number; companies: Set<string> }>();
  for (const r of rounds) {
    if (!r.participants.some((p) => participantKey(p.name) === yvKey)) continue;
    const seen = new Set<string>();
    for (const p of r.participants) {
      const key = participantKey(p.name);
      if (key === yvKey || seen.has(key)) continue;
      seen.add(key);
      const entry = byKey.get(key) ?? { name: p.name, rounds: 0, led: 0, companies: new Set<string>() };
      entry.rounds += 1;
      if (p.isLead) entry.led += 1;
      entry.companies.add(companyName(r.startupId));
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .map((e) => ({ name: e.name, roundsWithYv: e.rounds, ledRounds: e.led, companies: [...e.companies].sort() }))
    .sort((a, b) => b.roundsWithYv - a.roundsWithYv || a.name.localeCompare(b.name));
}

/**
 * Disclosed capital per reported month (YYYY-MM), oldest first, with empty months filled in so the time
 * axis is continuous. Rounds without a date or amount are skipped.
 */
export function capitalByMonth(rounds: Pick<RoundLike, "announcedOn" | "amountUsd">[]): { month: string; usd: number; rounds: number }[] {
  const byMonth = new Map<string, { usd: number; rounds: number }>();
  for (const r of rounds) {
    if (!r.announcedOn || r.amountUsd == null) continue;
    const month = r.announcedOn.slice(0, 7);
    const m = byMonth.get(month) ?? { usd: 0, rounds: 0 };
    m.usd += r.amountUsd;
    m.rounds += 1;
    byMonth.set(month, m);
  }
  const keys = [...byMonth.keys()].sort();
  const first = keys[0];
  const last = keys.at(-1);
  if (!first || !last) return [];
  const out: { month: string; usd: number; rounds: number }[] = [];
  let [y, m] = first.split("-").map(Number) as [number, number];
  for (let month = first; month <= last;) {
    out.push({ month, ...(byMonth.get(month) ?? { usd: 0, rounds: 0 }) });
    m += 1;
    if (m > 12) [y, m] = [y + 1, 1];
    month = `${y}-${String(m).padStart(2, "0")}`;
  }
  return out;
}

/** Disclosed capital and company counts per sector, largest first. */
export function capitalBySector(
  rounds: Pick<RoundLike, "startupId" | "amountUsd">[],
  sectorOf: (startupId: string) => string | null,
): { sector: string; usd: number; companies: number }[] {
  const bySector = new Map<string, { usd: number; companies: Set<string> }>();
  for (const r of rounds) {
    const sector = sectorOf(r.startupId) ?? "—";
    const s = bySector.get(sector) ?? { usd: 0, companies: new Set<string>() };
    s.usd += r.amountUsd ?? 0;
    s.companies.add(r.startupId);
    bySector.set(sector, s);
  }
  return [...bySector.entries()]
    .map(([sector, v]) => ({ sector, usd: v.usd, companies: v.companies.size }))
    .sort((a, b) => b.usd - a.usd || a.sector.localeCompare(b.sector));
}

/**
 * Parses the staff "participants" textarea: one participant per line, `Name; amount; lead`.
 * Amount and "lead" are optional. Returns null when a line is malformed.
 */
export function parseParticipants(text: string): { name: string; amountUsd: number | null; isLead: boolean }[] | null {
  const out: { name: string; amountUsd: number | null; isLead: boolean }[] = [];
  const keys = new Set<string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const [namePart = "", amountPart = "", leadPart = ""] = line.split(";").map((s) => s.trim());
    const name = namePart.replace(/\s+/g, " ");
    if (!name || name.length > 120) return null;
    let amountUsd: number | null = null;
    if (amountPart) {
      const n = Number(amountPart.replace(/[\s,$]/g, ""));
      if (!Number.isFinite(n) || n <= 0) return null;
      amountUsd = n;
    }
    const lead = leadPart.toLowerCase();
    if (lead && lead !== "lead") return null;
    const key = participantKey(name);
    if (keys.has(key)) return null;
    keys.add(key);
    out.push({ name, amountUsd, isLead: lead === "lead" });
  }
  return out.length > 0 && out.length <= 30 ? out : null;
}

/** RFC 4180 CSV cell; also neutralises spreadsheet formula injection (=, +, -, @ prefixes). */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
