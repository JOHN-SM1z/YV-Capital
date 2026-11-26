import { describe, expect, it } from "vitest";
import { metricValue, parseMoney, usd, usdRange } from "./format";

describe("parseMoney", () => {
  it("accepts plain numbers, k / m suffixes and currency symbols", () => {
    expect(parseMoney("150000")).toBe(150_000);
    expect(parseMoney("150k")).toBe(150_000);
    expect(parseMoney("1.5M")).toBe(1_500_000);
    expect(parseMoney("$1,200")).toBe(1_200);
  });

  it("returns null for blank input", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });

  it("returns NaN for anything else so callers can reject it", () => {
    for (const bad of ["abc", "-5", "1e9", "12kk", "1.2.3"]) expect(parseMoney(bad)).toBeNaN();
  });
});

describe("money display", () => {
  it("abbreviates thousands and millions", () => {
    expect(usd(400_000)).toBe("$400K");
    expect(usd(1_250_000)).toBe("$1.25M");
    expect(usd(null)).toBe("—");
  });

  it("describes open-ended ranges", () => {
    expect(usdRange(null, null)).toBe("—");
    expect(usdRange(null, 100_000)).toBe("≤ $100K");
    expect(usdRange(100_000, null)).toBe("$100K+");
  });

  it("formats metric units", () => {
    expect(metricValue(22, "% MoM")).toBe("22% MoM");
    expect(metricValue(12_000, "USD")).toBe("$12K");
    expect(metricValue(500, "count")).toBe("500");
  });
});
