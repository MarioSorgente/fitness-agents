import type { JsonObject, JsonValue } from "../../schemas/intakeSchema";
import {
  bulletListBlock,
  compactBlocks,
  createSection,
  getStringList,
  stringifyJson,
  textBlock,
  type PdfSectionBlock,
} from "./Section";

function trainingBlocks(value: JsonValue): PdfSectionBlock[] {
  if (Array.isArray(value)) {
    return [bulletListBlock(value.map((item) => stringifyJson(item)).filter(Boolean))];
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, entry]) => ({
      type: "text",
      variant: "body",
      text: `${key}: ${stringifyJson(entry)}`,
    }));
  }

  return compactBlocks([textBlock(stringifyJson(value))]);
}

export function TrainingSection({ content }: { content: JsonObject }) {
  const training =
    content.training ?? content.trainingPlan ?? content.workouts ?? content.weeklyTraining ?? null;
  const progression = getStringList(content, [
    "progression",
    "progressions",
    "trainingProgression",
  ]);

  return createSection(
    "Training plan",
    compactBlocks([
      ...(training
        ? trainingBlocks(training)
        : compactBlocks([textBlock("No training plan provided.", "muted")])),
      textBlock("Progression notes", "subheading"),
      bulletListBlock(progression),
    ]),
    "Training",
  );
}
