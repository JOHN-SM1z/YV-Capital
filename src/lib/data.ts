import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { InvestorProfileForMatch, StartupProfileForMatch } from "@/lib/matching/types";
import { rows } from "@/lib/db";

export async function getStaff(supabase: ServerClient) {
  return rows(
    await supabase.from("user_profiles").select("id, full_name, email, user_type").in("user_type", ["yv_admin", "yv_team"]).order("full_name"),
    "staff",
  );
}

export type MatchInvestor = InvestorProfileForMatch & { orgId: string; isDemo: boolean };

/** All investors in the shape the matching engine needs (staff only, enforced by RLS). */
export async function getInvestorsForMatch(supabase: ServerClient): Promise<MatchInvestor[]> {
  const investors = rows(
    await supabase.from("investors").select("id, org_id, organizations(name, is_demo), investor_preferences(*), investor_relationships(status)"),
    "investors for match",
  );
  return investors.map((i) => {
    const prefs = i.investor_preferences;
    return {
      id: i.id,
      orgId: i.org_id,
      isDemo: i.organizations.is_demo,
      name: i.organizations.name,
      status: i.investor_relationships?.status ?? null,
      sectors: prefs?.sectors ?? [],
      stages: prefs?.stages ?? [],
      geographies: prefs?.geographies ?? [],
      minCheck: prefs?.min_check ?? null,
      maxCheck: prefs?.max_check ?? null,
      centralAsiaInterest: prefs?.central_asia_interest ?? false,
      coInvestAppetite: prefs?.co_invest_appetite ?? null,
    };
  });
}

export async function getStartupsForMatch(supabase: ServerClient, onlyId?: string): Promise<StartupProfileForMatch[]> {
  let query = supabase.from("startups").select("id, name, sector, funding_stage, country").is("deleted_at", null).neq("stage", "rejected");
  if (onlyId) query = query.eq("id", onlyId);
  const [startups, rounds] = await Promise.all([
    query,
    supabase
      .from("startup_fundraising")
      .select("startup_id, round_type, target_amount, min_ticket, max_ticket, created_at")
      .order("created_at", { ascending: false }),
  ]);
  const roundList = rows(rounds, "fundraising");
  // Newest first, so the first row seen per startup is its current round.
  const latest = new Map<string, (typeof roundList)[number]>();
  for (const r of roundList) if (!latest.has(r.startup_id)) latest.set(r.startup_id, r);
  return rows(startups, "startups for match").map((s) => {
    const r = latest.get(s.id);
    return {
      id: s.id,
      name: s.name,
      sector: s.sector,
      fundingStage: r?.round_type ?? s.funding_stage,
      country: s.country,
      roundTarget: r?.target_amount ?? null,
      minTicket: r?.min_ticket ?? null,
      maxTicket: r?.max_ticket ?? null,
    };
  });
}

/** Test (sandbox) organizations are never suggested as investors for real companies. */
export const realInvestors = (investors: MatchInvestor[]) => investors.filter((i) => !i.isDemo);

/** Used in every portal layout; a failure here must not take the whole portal down. */
export async function getUnreadCount(supabase: ServerClient, userId: string): Promise<number> {
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}

/** Public records for one startup, newest first. RLS limits non-staff to portfolio companies. */
export async function getPublicRecords(supabase: ServerClient, startupId: string) {
  return rows(
    await supabase.from("startup_public_records").select("*").eq("startup_id", startupId).order("published_on", { ascending: false, nullsFirst: false }),
    "public records",
  );
}
