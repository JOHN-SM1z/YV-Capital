import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, isStaff } from "@/lib/auth";
import { getPortfolio } from "@/lib/portfolio";
import { getAllRounds } from "@/lib/funding";
import { YV_NAME, participantKey, summarizeRounds, toCsv } from "@/lib/funding-stats";
import { rows } from "@/lib/db";
import { audit } from "@/lib/notify";
import { logServerError } from "@/lib/action-state";

const KINDS = ["portfolio", "investors"] as const;
type Kind = (typeof KINDS)[number];
const isKind = (v: string): v is Kind => KINDS.some((k) => k === v);

/**
 * Staff-only CSV export. The role is checked here and every read still goes through RLS.
 * Exports carry public and profile fields only: no internal notes, outlooks or diligence content.
 * Each export is written to the audit log.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/export/[kind]">) {
  const { kind } = await ctx.params;
  if (!isKind(kind)) return new NextResponse("Not found", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!isStaff(user)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  let csv: string;
  let count: number;
  try {
    ({ csv, count } = kind === "portfolio" ? await portfolioCsv(supabase) : await investorsCsv(supabase));
  } catch (e) {
    logServerError(`export.${kind}`, e);
    return new NextResponse("Export failed", { status: 500 });
  }
  await audit(supabase, `export.${kind}`, "export", user.id, { rows: String(count) });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yv-${kind}-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function portfolioCsv(supabase: Client) {
  const [portfolio, rounds, checksRes] = await Promise.all([
    getPortfolio(supabase),
    getAllRounds(supabase),
    supabase.from("startups").select("id, yv_check_usd").eq("is_portfolio", true).is("deleted_at", null),
  ]);
  const checks = new Map(rows(checksRes, "yv checks").map((s) => [s.id, s.yv_check_usd]));
  const yvKey = participantKey(YV_NAME);
  const data = portfolio.map((c) => {
    const own = rounds.filter((r) => r.startupId === c.id);
    const s = summarizeRounds(own);
    const coInvestors = [...new Set(own.flatMap((r) => r.participants.map((p) => p.name)).filter((n) => participantKey(n) !== yvKey))].sort();
    return [
      c.name,
      c.sector,
      c.website,
      checks.get(c.id) ?? null,
      s.roundCount,
      s.disclosedUsd,
      s.undisclosedCount,
      s.lastReportedOn,
      c.last_round_type,
      coInvestors.join("; "),
      c.record_count,
      c.last_record_on,
    ];
  });
  const header = [
    "Company",
    "Sector",
    "Website",
    "YV listing figure, USD (unlabelled on yoshlarventures.uz)",
    "Sourced rounds",
    "Disclosed funding, USD (public sources)",
    "Rounds without disclosed amount",
    "Last round reported on",
    "Last round type (if stated)",
    "Co-investors named in sources",
    "Public records",
    "Latest record date",
  ];
  return { csv: toCsv(header, data), count: data.length };
}

async function investorsCsv(supabase: Client) {
  const result = await supabase
    .from("investors")
    .select(
      "category, headquarters, evidence_type, evidence_summary, evidence_url, evidence_date, uzbek_companies, organizations!inner(name, country, is_demo), investor_preferences(sectors, stages, min_check, max_check, central_asia_interest), investor_relationships(status, priority)",
    )
    .eq("organizations.is_demo", false);
  const data = rows(result, "investors export")
    .map((i) => [
      i.organizations.name,
      i.category,
      i.headquarters,
      i.organizations.country,
      i.evidence_type,
      i.evidence_summary,
      i.evidence_url,
      i.evidence_date,
      i.uzbek_companies.join("; "),
      i.investor_preferences?.sectors.join("; ") ?? "",
      i.investor_preferences?.stages.join("; ") ?? "",
      i.investor_preferences?.min_check ?? null,
      i.investor_preferences?.max_check ?? null,
      i.investor_preferences?.central_asia_interest ? "yes" : "no",
      i.investor_relationships?.status ?? "",
      i.investor_relationships?.priority ?? "",
    ])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const header = [
    "Investor",
    "Category",
    "Headquarters",
    "Country",
    "Uzbekistan evidence type",
    "Evidence summary",
    "Evidence URL",
    "Evidence date",
    "Uzbek companies named in evidence",
    "Sectors (inferred from sources unless edited)",
    "Stages (inferred from sources unless edited)",
    "Min check, USD",
    "Max check, USD",
    "Central Asia interest",
    "Relationship status",
    "Priority",
  ];
  return { csv: toCsv(header, data), count: data.length };
}
