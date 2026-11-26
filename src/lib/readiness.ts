import type { Dictionary } from "@/i18n/dictionaries/en";

type TaskKey = keyof Dictionary["readinessTasks"];

/** The default checklist. English titles are what is stored in the database. */
export const DEFAULT_READINESS: readonly { key: TaskKey; title: string }[] = [
  { key: "profile", title: "Company profile completed" },
  { key: "pitchDeck", title: "Pitch deck uploaded" },
  { key: "financialModel", title: "Financial model submitted" },
  { key: "metrics", title: "Revenue and traction metrics documented" },
  { key: "capTable", title: "Cap table submitted" },
  { key: "corporate", title: "Corporate documents submitted" },
  { key: "market", title: "Market analysis completed" },
  { key: "fundraising", title: "Fundraising requirements documented" },
  { key: "management", title: "Management team information completed" },
];

/** Default tasks are shown in the user's language; custom tasks appear exactly as YV wrote them. */
export function taskTitle(t: Dictionary, stored: string): string {
  const match = DEFAULT_READINESS.find((d) => d.title === stored);
  return match ? t.readinessTasks[match.key] : stored;
}
