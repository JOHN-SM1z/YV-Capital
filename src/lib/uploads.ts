/** Upload validation shared by the browser (pre-check) and the server (authoritative check). */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type Kind = { mime: string; signature: readonly number[] | "text" };

const ZIP = [0x50, 0x4b, 0x03, 0x04] as const;

export const ALLOWED: Readonly<Record<string, Kind>> = {
  pdf: { mime: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  png: { mime: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
  jpg: { mime: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  jpeg: { mime: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", signature: ZIP },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: ZIP },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", signature: ZIP },
  csv: { mime: "text/csv", signature: "text" },
};

export const ACCEPT_ATTR = Object.keys(ALLOWED)
  .map((e) => "." + e)
  .join(",");

/** Error codes are keys of `t.upload`, so both browser and server can show them in the user's language. */
export type UploadError = "type" | "empty" | "tooBig" | "mismatch";

export type UploadCheck = { ok: true; mime: string; ext: string } | { ok: false; error: UploadError };

export function validateUpload(file: { name: string; size: number; head: Uint8Array }): UploadCheck {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const kind = Object.hasOwn(ALLOWED, ext) ? ALLOWED[ext] : undefined;
  if (!kind) return { ok: false, error: "type" };
  if (file.size <= 0) return { ok: false, error: "empty" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooBig" };

  if (kind.signature === "text") {
    const sample = file.head.subarray(0, 512);
    // Binary content: NUL bytes, or a Windows executable header ("MZ").
    if (sample.includes(0) || (sample[0] === 0x4d && sample[1] === 0x5a)) return { ok: false, error: "mismatch" };
  } else {
    const signature = kind.signature;
    if (file.head.length < signature.length || signature.some((byte, i) => file.head[i] !== byte)) return { ok: false, error: "mismatch" };
  }
  return { ok: true, mime: kind.mime, ext };
}

/** Storage-safe object name: keeps letters, digits, dot, dash, underscore. */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_");
  return cleaned.slice(-120) || "file";
}
