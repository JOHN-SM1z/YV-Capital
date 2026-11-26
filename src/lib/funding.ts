import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { rows } from "@/lib/db";
import type { RoundLike } from "@/lib/funding-stats";

export type FundingRound = RoundLike & {
  id: string;
  note: string | null;
  source: { title: string; url: string; publisher: string } | null;
};

const ROUND_SELECT =
  "id, startup_id, round_type, announced_on, amount_usd, note, source:startup_public_records(title, url, publisher), round_participants(name, amount_usd, is_lead)";

type RoundRow = {
  id: string;
  startup_id: string;
  round_type: string | null;
  announced_on: string | null;
  amount_usd: number | null;
  note: string | null;
  source: { title: string; url: string; publisher: string } | null;
  round_participants: { name: string; amount_usd: number | null; is_lead: boolean }[];
};

function toRound(r: RoundRow): FundingRound {
  return {
    id: r.id,
    startupId: r.startup_id,
    roundType: r.round_type,
    announcedOn: r.announced_on,
    amountUsd: r.amount_usd,
    note: r.note,
    source: r.source,
    // Lead first, then by disclosed amount, so the biggest backers read first.
    participants: r.round_participants
      .map((p) => ({ name: p.name, amountUsd: p.amount_usd, isLead: p.is_lead }))
      .sort((a, b) => Number(b.isLead) - Number(a.isLead) || (b.amountUsd ?? 0) - (a.amountUsd ?? 0) || a.name.localeCompare(b.name)),
  };
}

/** Sourced funding rounds of one company, newest first. RLS limits non-staff to portfolio companies. */
export async function getRounds(supabase: ServerClient, startupId: string): Promise<FundingRound[]> {
  const result = await supabase
    .from("funding_rounds")
    .select(ROUND_SELECT)
    .eq("startup_id", startupId)
    .order("announced_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return rows(result, "funding rounds").map(toRound);
}

/** Every round the caller may read (staff: all companies). Used for insights and export. */
export async function getAllRounds(supabase: ServerClient): Promise<FundingRound[]> {
  const result = await supabase.from("funding_rounds").select(ROUND_SELECT).order("announced_on", { ascending: false, nullsFirst: false });
  return rows(result, "all funding rounds").map(toRound);
}

/** Ids of companies the signed-in user follows. */
export async function getFollowedIds(supabase: ServerClient, userId: string): Promise<Set<string>> {
  const result = await supabase.from("company_follows").select("startup_id").eq("user_id", userId);
  return new Set(rows(result, "follows").map((f) => f.startup_id));
}

/** Staff only (RLS): number of investor users following each company — an internal interest signal. */
export async function getInvestorFollowCounts(supabase: ServerClient): Promise<Map<string, number>> {
  const result = await supabase.from("company_follows").select("startup_id, user_profiles!inner(user_type)").eq("user_profiles.user_type", "investor");
  const counts = new Map<string, number>();
  for (const f of rows(result, "follow counts")) counts.set(f.startup_id, (counts.get(f.startup_id) ?? 0) + 1);
  return counts;
}
