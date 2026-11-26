import { redirect } from "next/navigation";

/** The next-round outlook now lives in the Startups list and on each company page; old links keep working. */
export default async function NextRoundsRedirect({ searchParams }: PageProps<"/admin/next-rounds">) {
  const { likelihood } = await searchParams;
  redirect(typeof likelihood === "string" ? `/admin/startups?outlook=${encodeURIComponent(likelihood)}` : "/admin/startups?sort=outlook");
}
