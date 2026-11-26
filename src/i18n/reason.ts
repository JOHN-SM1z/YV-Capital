import { fmt } from "./config";
import type { Dictionary } from "./dictionaries/en";
import type { MatchReason } from "@/lib/matching/types";
import { isKeyOf } from "@/lib/labels";

const stageLabel = (labels: Dictionary["enums"]["funding_stage"], s: string) => (isKeyOf(labels, s) ? labels[s] : s);

/** Renders a structured match reason in the current language. */
export function reasonText(t: Dictionary, reason: MatchReason): string {
  const p = { ...(reason.params ?? {}) };
  if (p.stage) p.stage = stageLabel(t.enums.funding_stage, p.stage);
  if (p.stages)
    p.stages = p.stages
      .split(",")
      .map((s) => stageLabel(t.enums.funding_stage, s))
      .join(", ");
  if (p.region === "Central Asia") p.region = t.match.centralAsia;
  return fmt(t.match[reason.code], p);
}
