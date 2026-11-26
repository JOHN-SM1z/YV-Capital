import { describe, expect, it } from "vitest";
import {
  capitalByMonth,
  capitalBySector,
  nameKeys,
  csvCell,
  parseParticipants,
  participantKey,
  rankCoInvestors,
  summarizeRounds,
  toCsv,
  type RoundLike,
} from "./funding-stats";

const round = (startupId: string, announcedOn: string | null, amountUsd: number | null, names: (string | [string, boolean])[]): RoundLike => ({
  startupId,
  announcedOn,
  amountUsd,
  roundType: null,
  participants: names.map((n) => (typeof n === "string" ? { name: n, amountUsd: null, isLead: false } : { name: n[0], amountUsd: null, isLead: n[1] })),
});

describe("summarizeRounds", () => {
  it("sums only disclosed amounts and counts undisclosed rounds separately", () => {
    const s = summarizeRounds([
      { announcedOn: "2026-06-18", amountUsd: 110000 },
      { announcedOn: null, amountUsd: null },
      { announcedOn: "2025-09-12", amountUsd: 50000 },
    ]);
    expect(s).toEqual({ roundCount: 3, disclosedUsd: 160000, undisclosedCount: 1, lastReportedOn: "2026-06-18" });
  });

  it("reports no total (not zero) when nothing is disclosed", () => {
    expect(summarizeRounds([{ announcedOn: null, amountUsd: null }]).disclosedUsd).toBeNull();
    expect(summarizeRounds([])).toEqual({ roundCount: 0, disclosedUsd: null, undisclosedCount: 0, lastReportedOn: null });
  });
});

describe("rankCoInvestors", () => {
  const names: Record<string, string> = { a: "Alpha", b: "Beta", c: "Gamma" };
  it("ranks funds by rounds shared with YV, merging spelling variants and excluding YV", () => {
    const ranked = rankCoInvestors(
      [
        round("a", "2026-01-01", 1, ["Yoshlar Ventures", ["Aloqa Ventures", true], "IT Park Ventures"]),
        round("b", "2026-02-01", 1, ["Yoshlar Ventures", "AloqaVentures"]),
        round("c", "2026-03-01", 1, ["Sarmo Ventures"]), // YV not in this round
      ],
      (id) => names[id] ?? id,
    );
    expect(ranked).toEqual([
      { name: "Aloqa Ventures", roundsWithYv: 2, ledRounds: 1, companies: ["Alpha", "Beta"] },
      { name: "IT Park Ventures", roundsWithYv: 1, ledRounds: 0, companies: ["Alpha"] },
    ]);
  });

  it("counts a fund once per round even if listed twice", () => {
    const ranked = rankCoInvestors([round("a", null, null, ["Yoshlar Ventures", "IT Park Ventures", "IT Park  ventures"])], () => "Alpha");
    expect(ranked).toEqual([{ name: "IT Park Ventures", roundsWithYv: 1, ledRounds: 0, companies: ["Alpha"] }]);
  });
});

describe("capitalByMonth / capitalBySector", () => {
  const rounds = [round("a", "2026-07-27", 30000, []), round("b", "2026-07-02", 40000, []), round("a", null, 15000, []), round("c", "2026-10-13", null, [])];
  it("groups disclosed, dated rounds by month", () => {
    expect(capitalByMonth(rounds)).toEqual([{ month: "2026-07", usd: 70000, rounds: 2 }]);
  });
  it("fills empty months, across a year boundary, so the time axis is continuous", () => {
    const months = capitalByMonth([
      { announcedOn: "2025-11-03", amountUsd: 10 },
      { announcedOn: "2026-02-20", amountUsd: 5 },
    ]).map((m) => `${m.month}:${m.usd}`);
    expect(months).toEqual(["2025-11:10", "2025-12:0", "2026-01:0", "2026-02:5"]);
  });
  it("groups by sector with distinct company counts", () => {
    const sector: Record<string, string> = { a: "AI", b: "AI", c: "FinTech" };
    expect(capitalBySector(rounds, (id) => sector[id] ?? null)).toEqual([
      { sector: "AI", usd: 85000, companies: 2 },
      { sector: "FinTech", usd: 0, companies: 1 },
    ]);
  });
});

describe("parseParticipants", () => {
  it("parses name; amount; lead lines", () => {
    expect(parseParticipants("Aloqa Ventures; 60,000; lead\n\nYoshlar Ventures; $50000\nIT Park Ventures")).toEqual([
      { name: "Aloqa Ventures", amountUsd: 60000, isLead: true },
      { name: "Yoshlar Ventures", amountUsd: 50000, isLead: false },
      { name: "IT Park Ventures", amountUsd: null, isLead: false },
    ]);
  });
  it("rejects malformed input", () => {
    expect(parseParticipants("")).toBeNull();
    expect(parseParticipants("Fund; abc")).toBeNull();
    expect(parseParticipants("Fund; -5")).toBeNull();
    expect(parseParticipants("Fund; 5; maybe")).toBeNull();
    expect(parseParticipants("Fund A\nfund a")).toBeNull();
    expect(parseParticipants("x".repeat(121))).toBeNull();
  });
});

describe("nameKeys", () => {
  it("matches a bracketed alias and the main name", () => {
    const keys = nameKeys("Politecnico di Torino (Turin Polytechnic University)");
    expect(keys).toContain(participantKey("Turin Polytechnic University"));
    expect(keys).toContain(participantKey("Politecnico di Torino"));
    expect(nameKeys("Sturgeon Capital")).toEqual(["sturgeoncapital"]);
  });
});

describe("participantKey", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(participantKey("Aloqa Ventures")).toBe(participantKey("AloqaVentures"));
    expect(participantKey("IT-Park Ventures")).toBe(participantKey("it park ventures"));
  });
});

describe("csv", () => {
  it("quotes separators and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x\ny"]])).toBe('a,b\r\n1,"x\ny"\r\n');
  });
});
