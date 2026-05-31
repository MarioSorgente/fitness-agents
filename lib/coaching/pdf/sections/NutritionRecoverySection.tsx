import React from "react";
import { Text } from "@react-pdf/renderer";

import { pdfStyles } from "../pdfTheme";
import type { JsonObject } from "../../schemas/intakeSchema";
import { BulletList, Section, getStringList, getText } from "./Section";

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

  return (
    <Section eyebrow="Support" title="Nutrition, recovery, and safety">
      <Text style={pdfStyles.subheading}>Nutrition</Text>
      <Text style={nutritionText ? pdfStyles.body : pdfStyles.muted}>
        {nutritionText || "No nutrition guidance provided."}
      </Text>
      <Text style={pdfStyles.subheading}>Recovery</Text>
      <Text style={recoveryText ? pdfStyles.body : pdfStyles.muted}>
        {recoveryText || "No recovery guidance provided."}
      </Text>
      <Text style={pdfStyles.subheading}>Habits</Text>
      <BulletList items={habits} />
      <Text style={pdfStyles.subheading}>Safety notes</Text>
      <BulletList items={safety} />
    </Section>
  );
}
