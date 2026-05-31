import type { JsonObject } from "../../schemas/intakeSchema";
import {
  bulletListBlock,
  compactBlocks,
  createSection,
  getStringList,
  getText,
  keyValueBlock,
  textBlock,
} from "./Section";

export function PlanSummarySection({ content }: { content: JsonObject }) {
  const overview = getText(content, ["overview", "summary", "executiveSummary", "planSummary"]);
  const goals = getStringList(content, ["goals", "primaryGoals", "objectives"]);
  const focusAreas = getStringList(content, ["focusAreas", "priorities", "keyPriorities"]);

  return createSection(
    "Plan summary",
    compactBlocks([
      textBlock(overview),
      keyValueBlock([
        ["Training phase", getText(content, ["phase", "trainingPhase", "programPhase"])],
        ["Schedule", getText(content, ["schedule", "weeklySchedule", "availability"])],
        ["Duration", getText(content, ["duration", "programDuration", "timeHorizon"])],
      ]),
      textBlock("Goals", "subheading"),
      bulletListBlock(goals),
      textBlock("Focus areas", "subheading"),
      bulletListBlock(focusAreas),
    ]),
    "Overview",
  );
}
