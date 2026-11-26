import { redirect } from "next/navigation";
import { getSessionUser, homeFor } from "@/lib/auth";

/** Routes each person to their portal; accounts without access see /pending. */
export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? homeFor(user.userType) : "/pending");
}
