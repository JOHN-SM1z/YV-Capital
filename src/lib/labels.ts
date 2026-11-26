import type { Database } from "@/lib/database.types";
import type { Tone } from "@/components/ui";

type E = Database["public"]["Enums"];

/* Visual tone per enum value. Human-readable labels live in the i18n dictionaries (t.enums.*). */

export const RELATIONSHIP_TONE: Record<E["relationship_status"], Tone> = {
  identified: "neutral",
  researched: "neutral",
  qualified: "info",
  contacted: "info",
  meeting_scheduled: "info",
  meeting_completed: "info",
  interested: "brand",
  due_diligence: "brand",
  negotiation: "brand",
  partnership_signed: "pos",
  inactive: "neutral",
  rejected: "neg",
};
export const OPPORTUNITY_TONE: Record<E["opportunity_status"], Tone> = {
  draft: "neutral",
  internal_review: "warn",
  approved: "info",
  shared: "brand",
  paused: "neutral",
  closed: "pos",
  withdrawn: "neg",
};
export const INTEREST_TONE: Record<E["interest_level"], Tone> = { interested: "brand", info_requested: "info", indicative: "pos", declined: "neutral" };
export const DD_TONE: Record<E["dd_status"], Tone> = { open: "warn", with_startup: "info", answered: "brand", released: "pos", closed: "neutral" };
export const DOC_TONE: Record<E["doc_status"], Tone> = { submitted: "info", under_review: "warn", info_required: "warn", verified: "pos", rejected: "neg" };
export const VERIFICATION_TONE: Record<E["verification_status"], Tone> = {
  founder_submitted: "neutral",
  yv_verified: "pos",
  public_source: "info",
  rejected: "neg",
};
export const MEETING_TONE: Record<E["meeting_status"], Tone> = { requested: "warn", scheduled: "info", completed: "pos", cancelled: "neutral" };
export const LIKELIHOOD_TONE: Record<E["round_likelihood"], Tone> = { high: "pos", medium: "info", low: "neutral", insufficient_data: "warn" };
export const REQUEST_TONE: Record<E["request_status"], Tone> = { open: "warn", answered: "pos", closed: "neutral" };

export const LIKELIHOOD_ORDER: Record<E["round_likelihood"], number> = { high: 0, medium: 1, low: 2, insufficient_data: 3 };

export type EvidenceType = "investment" | "partnership" | "stated_interest";
export const EVIDENCE_TONE: Record<EvidenceType, Tone> = { investment: "pos", partnership: "info", stated_interest: "neutral" };
export const isEvidenceType = (v: unknown): v is EvidenceType => v === "investment" || v === "partnership" || v === "stated_interest";

export type RecordKind = "funding" | "news" | "directory" | "award" | "other";
export const RECORD_KINDS: RecordKind[] = ["funding", "news", "directory", "award", "other"];
export const isRecordKind = (v: unknown): v is RecordKind => RECORD_KINDS.some((k) => k === v);

/* Option lists (values; labels come from t.enums). */

export const FUNDING_STAGES = ["pre_seed", "seed", "series_a", "series_b", "growth"] as const;
export const ROUND_TYPES = [...FUNDING_STAGES, "bridge"] as const;
export type FundingStage = (typeof FUNDING_STAGES)[number];
export type RoundType = (typeof ROUND_TYPES)[number];
export const isFundingStage = (v: unknown): v is FundingStage => FUNDING_STAGES.some((s) => s === v);
export const isRoundType = (v: unknown): v is RoundType => ROUND_TYPES.some((r) => r === v);

export const DOC_TYPES = [
  "pitch_deck",
  "financial_statements",
  "financial_model",
  "cap_table",
  "corporate_registration",
  "shareholder_info",
  "product_info",
  "other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const isDocType = (v: unknown): v is DocType => DOC_TYPES.some((d) => d === v);

export const METRIC_KEYS = ["revenue", "mrr", "arr", "growth_rate", "customers", "active_users", "gmv", "burn"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export const isMetricKey = (v: unknown): v is MetricKey => METRIC_KEYS.some((m) => m === v);

/** Narrows an arbitrary string (usually from the database) to a key of a lookup table. */
export const isKeyOf = <T extends object>(table: T, key: string): key is Extract<keyof T, string> => Object.hasOwn(table, key);

export const SECTORS = [
  "AI / SaaS",
  "AdTech",
  "AgriTech",
  "Computer Vision",
  "Cybersecurity",
  "E-commerce",
  "EdTech",
  "FinTech",
  "FoodTech",
  "HealthTech",
  "HR Tech",
  "IoT",
  "Logistics",
  "MarTech",
  "Media",
  "Mobility",
  "PropTech",
  "TravelTech",
];

export const GEOGRAPHIES = ["Central Asia", "Caucasus", "MENA", "Turkey", "Europe", "Southeast Asia", "Asia", "Emerging Markets", "Global"];
