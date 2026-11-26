import { describe, expect, it } from "vitest";
import { tashkentToIso } from "./time";

describe("tashkentToIso", () => {
  it("converts Tashkent wall time to UTC", () => {
    expect(tashkentToIso("2026-11-26T14:30")).toBe("2026-11-26T09:30:00.000Z");
  });

  it("crosses the date line correctly", () => {
    expect(tashkentToIso("2026-01-01T02:00")).toBe("2025-12-31T21:00:00.000Z");
  });

  it("returns null for blank input", () => {
    expect(tashkentToIso(null)).toBeNull();
    expect(tashkentToIso("")).toBeNull();
  });

  it("rejects malformed and impossible dates", () => {
    expect(tashkentToIso("tomorrow")).toBe("invalid");
    expect(tashkentToIso("2026-13-01T10:00")).toBe("invalid");
    expect(tashkentToIso("2026-02-30T10:00")).toBe("invalid");
  });
});
