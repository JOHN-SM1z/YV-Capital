import "server-only";
import { publicEnv } from "@/lib/env";

/** Identity providers offered on the sign-in and sign-up pages. "azure" is Supabase's name for Microsoft. */
export const OAUTH_PROVIDERS = ["google", "apple", "azure"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
export const isOAuthProvider = (v: unknown): v is OAuthProvider => OAUTH_PROVIDERS.some((p) => p === v);

/**
 * Which providers are switched on in Supabase Auth (public settings endpoint; cached for 5 minutes).
 * A provider turned on in the Supabase dashboard appears on the sign-in page without a deploy.
 */
export async function getEnabledProviders(): Promise<Record<OAuthProvider, boolean>> {
  const none = { google: false, apple: false, azure: false };
  try {
    const res = await fetch(`${publicEnv.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publicEnv.supabasePublishableKey },
      next: { revalidate: 300 },
    });
    if (!res.ok) return none;
    const body: unknown = await res.json();
    const external = body && typeof body === "object" && "external" in body ? body.external : null;
    if (!external || typeof external !== "object") return none;
    const on = (k: OAuthProvider) => k in external && Reflect.get(external, k) === true;
    return { google: on("google"), apple: on("apple"), azure: on("azure") };
  } catch {
    return none;
  }
}
