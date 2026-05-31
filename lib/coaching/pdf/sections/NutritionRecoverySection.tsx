import type { JsonObject } from "../../schemas/intakeSchema";
import {
  bulletListBlock,
  compactBlocks,
  createSection,
  getStringList,
  getText,
  textBlock,
} from "./Section";

export function NutritionRecoverySection({ content }: { content: JsonObject }) {
  const nutritionText = getText(content, ["nutrition", "nutritionGuidance", "fueling"]);
  const recoveryText = getText(content, ["recovery", "recoveryGuidance", "sleepRecovery"]);
  const habits = getStringList(content, ["habits", "habitPlan", "lifestyleHabits"]);
  const safety = getStringList(content, [
    "safety",
    "safetyNotes",
    "contraindications",
    "modifications",
  ]);

  return createSection(
    "Nutrition, recovery, and safety",
    compactBlocks([
      textBlock("Nutrition", "subheading"),
      textBlock(
        nutritionText || "No nutrition guidance provided.",
        nutritionText ? "body" : "muted",
      ),
      textBlock("Recovery", "subheading"),
      textBlock(recoveryText || "No recovery guidance provided.", recoveryText ? "body" : "muted"),
      textBlock("Habits", "subheading"),
      bulletListBlock(habits),
      textBlock("Safety notes", "subheading"),
      bulletListBlock(safety),
    ]),
    "Support",
  );
}
