import React from "react";
import { Text, View } from "@react-pdf/renderer";

import { pdfStyles } from "../pdfTheme";
import type { JsonObject, JsonValue } from "../../schemas/intakeSchema";
import { BulletList, Section, getStringList, stringifyJson } from "./Section";

function renderTrainingBlock(value: JsonValue): React.ReactNode {
  if (Array.isArray(value)) {
    return <BulletList items={value.map((item) => stringifyJson(item)).filter(Boolean)} />;
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, entry]) => (
      <View key={key} style={pdfStyles.panel}>
        <Text style={pdfStyles.subheading}>{key}</Text>
        <Text>{stringifyJson(entry)}</Text>
      </View>
    ));
  }

  return <Text>{stringifyJson(value)}</Text>;
}

export function TrainingSection({ content }: { content: JsonObject }) {
  const training =
    content.training ?? content.trainingPlan ?? content.workouts ?? content.weeklyTraining ?? null;
  const progression = getStringList(content, [
    "progression",
    "progressions",
    "trainingProgression",
  ]);

  return (
    <Section eyebrow="Training" title="Training plan">
      {training ? (
        renderTrainingBlock(training)
      ) : (
        <Text style={pdfStyles.muted}>No training plan provided.</Text>
      )}
      <Text style={pdfStyles.subheading}>Progression notes</Text>
      <BulletList items={progression} />
    </Section>
  );
}
