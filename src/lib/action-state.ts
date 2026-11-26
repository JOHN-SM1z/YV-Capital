import type { Dictionary } from "@/i18n/dictionaries/en";

export type ActionState = { ok?: boolean; error?: string; message?: string };

export const ok = (message?: string): ActionState => ({ ok: true, message });
export const fail = (error: string): ActionState => ({ ok: false, error });

type DbError = { code?: string; message?: string } | null | undefined;

/** Maps Postgres/PostgREST errors to localized, user-safe messages (no internals leak). */
export function dbError(t: Dictionary, e: DbError, fallback: string = t.errors.generic): ActionState {
  if (!e) return fail(fallback);
  switch (e.code) {
    case "42501":
      return fail(t.errors.permission);
    case "23505":
      return fail(t.errors.exists);
    case "23514":
      return fail(t.errors.outOfRange);
    case "P0001":
      // Raised by our own guard triggers; their messages are written for end users.
      return fail(e.message ?? fallback);
    default:
      logServerError("db", e);
      return fail(fallback);
  }
}

/**
 * Records an unexpected server-side failure without exposing it to the user. Only the error code and
 * message are logged — never form data, tokens or personal data.
 */
export function logServerError(context: string, e: unknown): void {
  const field = (name: "code" | "message") => (e && typeof e === "object" && name in e ? String(Reflect.get(e, name)) : undefined);
  console.error(`[yv:${context}]`, { code: field("code"), message: field("message") ?? (typeof e === "string" ? e : undefined) });
}
