import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type UserType = Database["public"]["Enums"]["user_type"];

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  userType: UserType;
  orgId: string;
  orgName: string;
  isOrgAdmin: boolean;
};

/**
 * The signed-in, *active* user, resolved from the database (never from client input).
 * Returns null when signed out or when the membership was deactivated.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;
  const { data, error } = await supabase.rpc("whoami");
  // A network/DB failure is not the same as "signed out": surface an error page instead of
  // bouncing a valid user to /login.
  if (error) throw new Error("Could not verify your session. Please try again.");
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    userType: row.user_type,
    orgId: row.org_id,
    orgName: row.org_name,
    isOrgAdmin: row.is_org_admin,
  };
});

export const homeFor = (t: UserType) => (t === "investor" ? "/investor" : t === "founder" ? "/startup" : "/admin");

/** True when there is a signed-in account, with or without platform access. */
export const hasAuthSession = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return !!data?.claims;
});

export type AccessRequest = Database["public"]["Tables"]["access_requests"]["Row"];

/** The signed-in account's own access request (RLS returns only theirs), or null. */
export const getMyAccessRequest = cache(async (): Promise<AccessRequest | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("access_requests").select("*").maybeSingle();
  if (error) throw new Error("Could not load your access request. Please try again.");
  return data;
});

/**
 * Server-side gate for layouts, pages and actions. Signed-out visitors go to /login; accounts without
 * an active membership (pending approval, declined or deactivated) go to /pending.
 */
export async function requireUser(allowed: UserType[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect((await hasAuthSession()) ? "/pending" : "/login");
  if (!allowed.includes(user.userType)) redirect(homeFor(user.userType));
  return user;
}

export const STAFF: UserType[] = ["yv_admin", "yv_team"];
export const isStaff = (u: SessionUser) => u.userType === "yv_admin" || u.userType === "yv_team";
export const isAdmin = (u: SessionUser) => u.userType === "yv_admin";
