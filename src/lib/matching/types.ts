export type InvestorProfileForMatch = {
  id: string;
  name: string;
  /** Internal relationship status; inactive/rejected investors are excluded from rankings. */
  status: string | null;
  sectors: string[];
  stages: string[];
  geographies: string[];
  minCheck: number | null;
  maxCheck: number | null;
  centralAsiaInterest: boolean;
  coInvestAppetite: "low" | "medium" | "high" | null;
};

export type StartupProfileForMatch = {
  id: string;
  name: string;
  sector: string | null;
  /** pre_seed | seed | series_a | series_b | growth | bridge */
  fundingStage: string | null;
  country: string;
  roundTarget: number | null;
  minTicket: number | null;
  maxTicket: number | null;
};

/**
 * Reasons are structured (code + params) rather than sentences so the UI can render them in
 * any supported language. Money params are pre-formatted ("$150K").
 */
export type MatchReasonCode =
  | "check_investor_unknown"
  | "check_startup_unknown"
  | "check_full"
  | "check_partial"
  | "check_none"
  | "stage_startup_unknown"
  | "stage_investor_unknown"
  | "stage_match"
  | "stage_mismatch"
  | "sector_agnostic"
  | "sector_startup_unknown"
  | "sector_match"
  | "sector_mismatch"
  | "geo_match"
  | "geo_broad"
  | "geo_none"
  | "coinvest_high"
  | "coinvest_low";

export type MatchReason = {
  kind: "pos" | "neg" | "neutral";
  code: MatchReasonCode;
  params?: Record<string, string>;
};

export type MatchFit = "strong" | "possible" | "weak" | "none";

export type MatchResult = {
  /** 0–100, one decimal place. */
  score: number;
  fit: MatchFit;
  reasons: MatchReason[];
};
