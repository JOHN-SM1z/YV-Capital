import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { maybeRow } from "@/lib/db";
import type { Database } from "@/lib/database.types";

type Startup = Database["public"]["Tables"]["startups"]["Row"];

/** The founder's own startup (RLS returns only theirs). */
export async function getMyStartup() {
  const supabase = await createClient();
  const startup = maybeRow(await supabase.from("startups").select("*").is("deleted_at", null).maybeSingle(), "my startup");
  if (!startup) notFound();
  return { supabase, startup };
}

const PROFILE_FIELDS = [
  "website",
  "headquarters",
  "sector",
  "one_liner",
  "description",
  "problem",
  "solution",
  "target_market",
  "business_model",
  "team_size",
  "founded_year",
  "funding_stage",
] as const satisfies readonly (keyof Startup)[];

/** Share of profile fields that are filled in. A completeness measure, not a quality score. */
export function profileCompletion(startup: Startup) {
  const filled = PROFILE_FIELDS.filter((f) => startup[f] != null && startup[f] !== "").length;
  return { filled, total: PROFILE_FIELDS.length, pct: Math.round((filled / PROFILE_FIELDS.length) * 100) };
}
