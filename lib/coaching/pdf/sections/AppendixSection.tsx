import React from "react";
import { Text, View } from "@react-pdf/renderer";

import { pdfStyles } from "../pdfTheme";
import type { CoachingAgentOutputs } from "../../schemas/coachingPlanSchema";
import { Section } from "./Section";

export function AppendixSection({
  agentOutputs,
}: {
  agentOutputs: CoachingAgentOutputs | undefined;
}) {
  if (!agentOutputs) {
    return null;
  }

  return (
    <Section eyebrow="Appendix" title="Review appendix">
      <View style={pdfStyles.codeBlock}>
        <Text>{JSON.stringify(agentOutputs.panelBrief ?? agentOutputs, null, 2)}</Text>
      </View>
    </Section>
  );
}
