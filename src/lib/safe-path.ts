const BASE = "https://yv.invalid";

/**
 * Returns `value` only if it is a path on this site, otherwise null. Resolving it with the URL parser
 * (rather than checking prefixes) catches tricks like "/\evil.com" or "/\t/evil.com", which browsers
 * normalise into a link to another host.
 */
export function safeRelativePath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  const url = new URL(value, BASE);
  if (url.origin !== BASE) return null;
  const path = url.pathname + url.search + url.hash;
  // A path such as "/..//evil.com" can normalise to "//evil.com", which is protocol-relative.
  return path.startsWith("//") ? null : path;
}
