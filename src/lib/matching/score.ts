import type { InvestorProfileForMatch, MatchFit, MatchReason, MatchResult, StartupProfileForMatch } from "./types";

/** Weights from the design doc. Sum = 100. */
export const WEIGHTS = { check: 30, stage: 25, sector: 25, geography: 15, coInvest: 5 } as const;

const EXCLUDED_STATUSES = new Set(["inactive", "rejected"]);
const CENTRAL_ASIA = new Set(["uzbekistan", "kazakhstan", "kyrgyzstan", "tajikistan", "turkmenistan"]);
const BROAD_GEOS = new Set(["global", "emerging markets"]);
const CO_INVEST_POINTS = { high: 5, medium: 3, low: 1 } as const;

type Part = { points: number; reason: MatchReason | null };

const norm = (s: string) => s.trim().toLowerCase();

export function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function scoreCheck(i: InvestorProfileForMatch, s: StartupProfileForMatch): Part & { disqualified: boolean } {
  const startupMax = s.maxTicket ?? s.roundTarget;
  if (i.minCheck == null && i.maxCheck == null) {
    return { points: WEIGHTS.check / 2, disqualified: false, reason: { kind: "neutral", code: "check_investor_unknown" } };
  }
  if (startupMax == null && s.minTicket == null) {
    return { points: WEIGHTS.check / 2, disqualified: false, reason: { kind: "neutral", code: "check_startup_unknown" } };
  }

  const iMin = i.minCheck ?? 0;
  const iMax = i.maxCheck ?? Number.POSITIVE_INFINITY;
  const sMin = s.minTicket ?? 0;
  const sMax = startupMax ?? Number.POSITIVE_INFINITY;
  const params = {
    min: formatUsd(iMin),
    max: i.maxCheck != null ? formatUsd(i.maxCheck) : "∞",
    need: s.roundTarget != null ? formatUsd(s.roundTarget) : `${formatUsd(sMin)}–${formatUsd(sMax)}`,
  };

  if (iMin > sMax || iMax < sMin) return { points: 0, disqualified: true, reason: { kind: "neg", code: "check_none", params } };
  if (iMin >= sMin && iMin <= sMax) return { points: WEIGHTS.check, disqualified: false, reason: { kind: "pos", code: "check_full", params } };
  return { points: WEIGHTS.check / 2, disqualified: false, reason: { kind: "neutral", code: "check_partial", params } };
}

function scoreStage(i: InvestorProfileForMatch, s: StartupProfileForMatch): Part {
  if (!s.fundingStage) return { points: WEIGHTS.stage / 2, reason: { kind: "neutral", code: "stage_startup_unknown" } };
  if (i.stages.length === 0) return { points: WEIGHTS.stage / 2, reason: { kind: "neutral", code: "stage_investor_unknown" } };
  const params = { stage: s.fundingStage, stages: i.stages.join(",") };
  return i.stages.map(norm).includes(norm(s.fundingStage))
    ? { points: WEIGHTS.stage, reason: { kind: "pos", code: "stage_match", params } }
    : { points: 0, reason: { kind: "neg", code: "stage_mismatch", params } };
}

function scoreSector(i: InvestorProfileForMatch, s: StartupProfileForMatch): Part {
  if (i.sectors.length === 0) return { points: WEIGHTS.sector / 2, reason: { kind: "neutral", code: "sector_agnostic" } };
  if (!s.sector) return { points: WEIGHTS.sector / 2, reason: { kind: "neutral", code: "sector_startup_unknown" } };
  const params = { sector: s.sector };
  return i.sectors.map(norm).includes(norm(s.sector))
    ? { points: WEIGHTS.sector, reason: { kind: "pos", code: "sector_match", params } }
    : { points: 0, reason: { kind: "neg", code: "sector_mismatch", params } };
}

function scoreGeography(i: InvestorProfileForMatch, s: StartupProfileForMatch): Part {
  const geos = i.geographies.map(norm);
  const country = norm(s.country);
  const inCentralAsia = CENTRAL_ASIA.has(country);
  const params = { region: inCentralAsia ? "Central Asia" : s.country };
  if (geos.includes(country) || (inCentralAsia && (i.centralAsiaInterest || geos.includes("central asia")))) {
    return { points: WEIGHTS.geography, reason: { kind: "pos", code: "geo_match", params } };
  }
  if (geos.some((g) => BROAD_GEOS.has(g))) {
    return { points: WEIGHTS.geography / 2, reason: { kind: "neutral", code: "geo_broad", params } };
  }
  return { points: 0, reason: { kind: "neg", code: "geo_none", params } };
}

function scoreCoInvest(i: InvestorProfileForMatch): Part {
  if (i.coInvestAppetite == null) return { points: WEIGHTS.coInvest / 2, reason: null };
  const points = CO_INVEST_POINTS[i.coInvestAppetite];
  if (i.coInvestAppetite === "high") return { points, reason: { kind: "pos", code: "coinvest_high" } };
  if (i.coInvestAppetite === "low") return { points, reason: { kind: "neg", code: "coinvest_low" } };
  return { points, reason: null };
}

function fitFor(score: number): MatchFit {
  if (score >= 70) return "strong";
  if (score >= 45) return "possible";
  return "weak";
}

export function scoreMatch(investor: InvestorProfileForMatch, startup: StartupProfileForMatch): MatchResult {
  const check = scoreCheck(investor, startup);
  if (check.disqualified) return { score: 0, fit: "none", reasons: check.reason ? [check.reason] : [] };

  const parts = [check, scoreStage(investor, startup), scoreSector(investor, startup), scoreGeography(investor, startup), scoreCoInvest(investor)];
  const score = Math.round(parts.reduce((sum, p) => sum + p.points, 0) * 10) / 10;
  const reasons = parts.flatMap((p) => (p.reason ? [p.reason] : []));
  return { score, fit: fitFor(score), reasons };
}

const byFitThenScore = (a: MatchResult, b: MatchResult) => Number(a.fit === "none") - Number(b.fit === "none") || b.score - a.score;

export function rankInvestors(startup: StartupProfileForMatch, investors: InvestorProfileForMatch[]) {
  return investors
    .filter((i) => !EXCLUDED_STATUSES.has(i.status ?? ""))
    .map((i) => ({ investorId: i.id, investorName: i.name, ...scoreMatch(i, startup) }))
    .sort(byFitThenScore);
}

export function rankStartups(investor: InvestorProfileForMatch, startups: StartupProfileForMatch[]) {
  return startups.map((s) => ({ startupId: s.id, startupName: s.name, ...scoreMatch(investor, s) })).sort(byFitThenScore);
}
