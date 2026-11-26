import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { rows } from "@/lib/db";

/**
 * Opportunities visible to the signed-in investor (RLS returns only those shared with their
 * organization), each with the curated startup card.
 */
export async function getMyOpportunities(supabase: ServerClient) {
  const opps = rows(
    await supabase
      .from("investment_opportunities")
      .select("id, title, thesis, sector, stage, target_amount, min_ticket, max_ticket, traction_highlights, status, shared_at")
      .order("shared_at", { ascending: false }),
    "my opportunities",
  );
  const cards = await Promise.all(opps.map((o) => supabase.rpc("investor_startup_card", { p_opportunity: o.id })));
  return opps.map((o, i) => ({ ...o, startup: cards[i]?.data?.[0] ?? null }));
}
