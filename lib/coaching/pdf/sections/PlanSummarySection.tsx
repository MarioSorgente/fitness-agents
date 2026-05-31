import React from "react";
import { Text } from "@react-pdf/renderer";

import { pdfStyles } from "../pdfTheme";
import type { JsonObject } from "../../schemas/intakeSchema";
import { BulletList, KeyValueList, Section, getStringList, getText } from "./Section";

export function PlanSummarySection({ content }: { content: JsonObject }) {
  const overview = getText(content, ["overview", "summary", "executiveSummary", "planSummary"]);
  const goals = getStringList(content, ["goals", "primaryGoals", "objectives"]);
  const focusAreas = getStringList(content, ["focusAreas", "priorities", "keyPriorities"]);

  return (
    <Section eyebrow="Overview" title="Plan summary">
      {overview ? <Text style={pdfStyles.body}>{overview}</Text> : null}
      <KeyValueList
        entries={[
          ["Training phase", getText(content, ["phase", "trainingPhase", "programPhase"])],
          ["Schedule", getText(content, ["schedule", "weeklySchedule", "availability"])],
          ["Duration", getText(content, ["duration", "programDuration", "timeHorizon"])],
        ]}
      />
      <Text style={pdfStyles.subheading}>Goals</Text>
      <BulletList items={goals} />
      <Text style={pdfStyles.subheading}>Focus areas</Text>
      <BulletList items={focusAreas} />
    </Section>
  );
}
