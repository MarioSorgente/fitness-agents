import type { CoachingAgentOutputs } from "../../schemas/coachingPlanSchema";
import { compactBlocks, createSection, textBlock } from "./Section";

export function AppendixSection({
  agentOutputs,
}: {
  agentOutputs: CoachingAgentOutputs | undefined;
}) {
  if (!agentOutputs) {
    return null;
  }

  return createSection(
    "Review appendix",
    compactBlocks([
      textBlock(JSON.stringify(agentOutputs.panelBrief ?? agentOutputs, null, 2), "code"),
    ]),
    "Appendix",
  );
}
