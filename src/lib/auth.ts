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

/** Server-side gate for layouts, pages and actions. */
export async function requireUser(allowed: UserType[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.userType)) redirect(homeFor(user.userType));
  return user;
}

export const STAFF: UserType[] = ["yv_admin", "yv_team"];
export const isStaff = (u: SessionUser) => u.userType === "yv_admin" || u.userType === "yv_team";
export const isAdmin = (u: SessionUser) => u.userType === "yv_admin";
