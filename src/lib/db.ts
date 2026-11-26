import "server-only";

type Result<T> = { data: T | null; error: { code?: string; message: string } | null };

/**
 * Unwraps a Supabase read for page rendering. A failed query throws (so the route's error boundary
 * shows "something went wrong") instead of silently rendering an empty list as if there were no data.
 */
export function rows<T>(result: Result<T[]>, context: string): T[] {
  if (result.error) throw new Error(`Query failed: ${context} (${result.error.code ?? "unknown"})`);
  return result.data ?? [];
}

/**
 * Like `rows`, for `maybeSingle()` queries where "no row" is a valid outcome. Infers from the whole
 * response type, because Supabase responses are a success/failure union.
 */
export function maybeRow<R extends Result<unknown>>(result: R, context: string): NonNullable<R["data"]> | null {
  if (result.error) throw new Error(`Query failed: ${context} (${result.error.code ?? "unknown"})`);
  return result.data ?? null;
}
