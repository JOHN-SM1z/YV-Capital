import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { rows } from "@/lib/db";

/**
 * Public fields of a portfolio company, as exposed to every signed-in member, with the funding summary
 * (round count, disclosed total, last reported round) computed from sourced rounds. Written by hand
 * because generated RPC types mark every column non-null.
 */
export type PortfolioCompany = {
  id: string;
  name: string;
  sector: string | null;
  one_liner: string | null;
  logo_url: string | null;
  website: string | null;
  country: string | null;
  founded_year: number | null;
  team_size: number | null;
  funding_stage: string | null;
  record_count: number;
  last_record_on: string | null;
  round_count: number;
  /** Sum of disclosed round amounts; null when no round discloses one. */
  disclosed_usd: number | null;
  last_round_on: string | null;
  last_round_type: string | null;
};

export async function getPortfolio(supabase: ServerClient): Promise<PortfolioCompany[]> {
  return rows(await supabase.rpc("portfolio_directory"), "portfolio directory");
}
