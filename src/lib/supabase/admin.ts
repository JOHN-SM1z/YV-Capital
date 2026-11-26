import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Privileged client that bypasses RLS. Only used for user invitations, after the caller has been
 * verified as a YV admin (or as an admin of the target organization) on the server.
 * Returns null when the secret key is not configured, so callers can show "not connected".
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient<Database>(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
