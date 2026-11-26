import { describe, expect, it } from "vitest";
import { safeFileName, validateUpload } from "./uploads";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0x20)]);

describe("validateUpload", () => {
  it("accepts a real PDF", () => {
    expect(validateUpload({ name: "deck.pdf", size: 1000, head: bytes(0x25, 0x50, 0x44, 0x46) })).toMatchObject({ ok: true, mime: "application/pdf" });
  });

  it("rejects mismatched signature (exe renamed to pdf)", () => {
    const r = validateUpload({ name: "deck.pdf", size: 1000, head: bytes(0x4d, 0x5a, 0x90, 0x00) });
    expect(r).toEqual({ ok: false, error: "mismatch" });
  });

  it("rejects disallowed extensions", () => {
    expect(validateUpload({ name: "run.exe", size: 10, head: bytes(0x4d, 0x5a) })).toEqual({ ok: false, error: "type" });
  });

  it("rejects files over 25 MB", () => {
    expect(validateUpload({ name: "a.pdf", size: 26 * 1024 * 1024, head: bytes(0x25, 0x50, 0x44, 0x46) })).toEqual({ ok: false, error: "tooBig" });
  });

  it("rejects empty files", () => {
    expect(validateUpload({ name: "a.pdf", size: 0, head: new Uint8Array() })).toEqual({ ok: false, error: "empty" });
  });

  it("does not treat inherited object keys as file types", () => {
    expect(validateUpload({ name: "x.constructor", size: 10, head: bytes(1) })).toEqual({ ok: false, error: "type" });
    expect(validateUpload({ name: "noextension", size: 10, head: bytes(1) })).toEqual({ ok: false, error: "type" });
  });

  it("accepts office files by zip signature", () => {
    expect(validateUpload({ name: "Cap Table.XLSX", size: 50, head: bytes(0x50, 0x4b, 0x03, 0x04) }).ok).toBe(true);
  });

  it("accepts csv text and rejects binary csv", () => {
    expect(validateUpload({ name: "m.csv", size: 20, head: new TextEncoder().encode("month,revenue\n1,2") }).ok).toBe(true);
    expect(validateUpload({ name: "m.csv", size: 20, head: new Uint8Array([0x41, 0x00, 0x42]) }).ok).toBe(false);
  });
});

describe("safeFileName", () => {
  it("strips path and unsafe characters", () => {
    expect(safeFileName("../../etc/passwd")).not.toContain("/");
    expect(safeFileName("Moliyaviy hisobot 2026 (final).pdf")).toBe("Moliyaviy_hisobot_2026_final_.pdf");
  });
});
