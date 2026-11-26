import { describe, expect, it } from "vitest";
import { rankInvestors, rankStartups, scoreMatch } from "./score";
import type { InvestorProfileForMatch, StartupProfileForMatch } from "./types";

const investor = (o: Partial<InvestorProfileForMatch> = {}): InvestorProfileForMatch => ({
  id: "i1",
  name: "Inv",
  status: "qualified",
  sectors: ["Logistics", "FinTech"],
  stages: ["seed"],
  geographies: ["Central Asia"],
  minCheck: 50_000,
  maxCheck: 250_000,
  centralAsiaInterest: false,
  coInvestAppetite: "high",
  ...o,
});

const startup = (o: Partial<StartupProfileForMatch> = {}): StartupProfileForMatch => ({
  id: "s1",
  name: "St",
  sector: "Logistics",
  fundingStage: "seed",
  country: "Uzbekistan",
  roundTarget: 150_000,
  minTicket: null,
  maxTicket: null,
  ...o,
});

describe("scoreMatch", () => {
  it("scores a perfect fit at 100 and labels it strong", () => {
    const r = scoreMatch(investor(), startup());
    expect(r.score).toBe(100);
    expect(r.fit).toBe("strong");
    expect(r.reasons.find((x) => x.code === "check_full")?.kind).toBe("pos");
  });

  it("returns fit none and score 0 when check ranges are disjoint", () => {
    const r = scoreMatch(investor({ minCheck: 2_000_000, maxCheck: 5_000_000 }), startup({ roundTarget: 150_000 }));
    expect(r.fit).toBe("none");
    expect(r.score).toBe(0);
    expect(r.reasons[0]).toMatchObject({ kind: "neg", code: "check_none", params: { min: "$2M", max: "$5M", need: "$150K" } });
  });

  it("handles missing check range with a neutral half score", () => {
    const r = scoreMatch(investor({ minCheck: null, maxCheck: null }), startup());
    expect(r.score).toBe(85); // 15 + 25 + 25 + 15 + 5
    expect(r.reasons.some((x) => x.kind === "neutral" && x.code === "check_investor_unknown")).toBe(true);
  });

  it("handles a startup with no round size yet", () => {
    const r = scoreMatch(investor(), startup({ roundTarget: null }));
    expect(r.score).toBe(85);
    expect(r.fit).toBe("strong");
    expect(r.reasons[0]?.code).toBe("check_startup_unknown");
  });

  it("treats an unknown startup stage as neutral", () => {
    const r = scoreMatch(investor(), startup({ fundingStage: null }));
    expect(r.score).toBe(87.5);
    expect(r.reasons.some((x) => x.code === "stage_startup_unknown")).toBe(true);
  });

  it("gives half geography points for a broad global mandate", () => {
    const r = scoreMatch(investor({ geographies: ["Global"] }), startup());
    expect(r.score).toBe(92.5);
    expect(r.reasons.some((x) => x.code === "geo_broad")).toBe(true);
  });

  it("omits the co-invest reason when appetite is unknown and scores it neutral", () => {
    const r = scoreMatch(investor({ coInvestAppetite: null }), startup());
    expect(r.score).toBe(97.5);
    expect(r.reasons.some((x) => x.code.startsWith("coinvest"))).toBe(false);
  });

  it("matches sectors case-insensitively", () => {
    const r = scoreMatch(investor({ sectors: ["logistics"] }), startup({ sector: "LOGISTICS" }));
    expect(r.score).toBe(100);
  });

  it("gives 0 for sector and stage mismatches", () => {
    const r = scoreMatch(investor({ sectors: ["EdTech"], stages: ["series_a"] }), startup());
    expect(r.score).toBe(50); // 30 + 0 + 0 + 15 + 5
    expect(r.fit).toBe("possible");
  });

  it("treats an empty sector list as sector-agnostic (neutral)", () => {
    const r = scoreMatch(investor({ sectors: [] }), startup());
    expect(r.score).toBe(87.5); // 30 + 25 + 12.5 + 15 + 5
  });

  it("awards geography for central-asia interest flag even without listed geographies", () => {
    const r = scoreMatch(investor({ geographies: ["Europe"], centralAsiaInterest: true }), startup());
    expect(r.score).toBe(100);
  });

  it("gives 0 geography when no regional interest", () => {
    const r = scoreMatch(investor({ geographies: ["Southeast Asia"], centralAsiaInterest: false }), startup());
    expect(r.score).toBe(85);
  });

  it("uses ticket range when round target is missing", () => {
    const r = scoreMatch(investor({ minCheck: 300_000, maxCheck: 500_000 }), startup({ roundTarget: null, minTicket: 25_000, maxTicket: 100_000 }));
    expect(r.fit).toBe("none");
  });

  it("scores partial check overlap at 15", () => {
    // investor 50–250K vs startup tickets 200–400K → overlaps but round target 400K exceeds max
    const r = scoreMatch(investor(), startup({ roundTarget: 400_000, minTicket: 200_000, maxTicket: 400_000 }));
    expect(r.score).toBe(85);
  });

  it("bands weak below 45", () => {
    const r = scoreMatch(investor({ sectors: ["EdTech"], stages: ["series_a"], geographies: [], coInvestAppetite: "low" }), startup());
    expect(r.score).toBe(31); // 30 + 0 + 0 + 0 + 1
    expect(r.fit).toBe("weak");
  });
});

describe("ranking", () => {
  it("rankInvestors excludes inactive and rejected investors and sorts by score", () => {
    const list = [
      investor({ id: "a", sectors: ["EdTech"] }),
      investor({ id: "b" }),
      investor({ id: "c", status: "inactive" }),
      investor({ id: "d", status: "rejected" }),
    ];
    const ranked = rankInvestors(startup(), list);
    expect(ranked.map((r) => r.investorId)).toEqual(["b", "a"]);
  });

  it("rankStartups sorts startups by score and keeps no-fit ones last", () => {
    const ranked = rankStartups(investor(), [startup({ id: "x", roundTarget: 5_000_000, minTicket: 1_000_000 }), startup({ id: "y" })]);
    expect(ranked[0]?.startupId).toBe("y");
    expect(ranked[1]?.fit).toBe("none");
  });
});
