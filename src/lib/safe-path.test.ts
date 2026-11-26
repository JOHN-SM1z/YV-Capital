import { describe, expect, it } from "vitest";
import { safeRelativePath } from "./safe-path";

describe("safeRelativePath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeRelativePath("/admin/startups?view=pipeline#top")).toBe("/admin/startups?view=pipeline#top");
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/..//evil.com",
    "javascript:alert(1)",
    "admin",
    "",
  ])("rejects %j", (value) => {
    expect(safeRelativePath(value)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(safeRelativePath(null)).toBeNull();
    expect(safeRelativePath(["/admin"])).toBeNull();
  });
});
