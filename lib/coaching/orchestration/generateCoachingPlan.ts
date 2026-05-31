import { createAnthropicProvider } from "../ai/anthropicProvider";
import { createKimiProvider } from "../ai/kimiProvider";
import { createOpenAiProvider } from "../ai/openaiProvider";
import {
  type CoachingAiCompletion,
  type CoachingAiProviderRegistry,
  type CoachingOrchestrationMode,
  type CoachingStepId,
  getRoutesForStep,
  runRoutedCompletion,
} from "../ai/provider";
import type { JsonObject, JsonValue } from "../db/coachingRepository";

const EXPERT_STEPS: Array<{
  id: CoachingStepId;
  title: string;
  instruction: string;
}> = [
  {
    id: "medical_safety_screener",
    title: "Medical safety screener",
    instruction:
      "Identify medical red flags, contraindications, information that requires clinician clearance, and safe coaching boundaries. Do not diagnose.",
  },
  {
    id: "physio_reviewer",
    title: "Physio reviewer",
    instruction:
      "Review movement limitations, pain considerations, regressions, progressions, and referral triggers from a conservative rehab-aware coaching lens.",
  },
  {
    id: "fitness_coach",
    title: "Fitness coach",
    instruction:
      "Design the training direction: weekly structure, strength and conditioning priorities, progression logic, and measurable milestones.",
  },
  {
    id: "mobility_coach",
    title: "Mobility coach",
    instruction:
      "Recommend mobility, warm-up, cooldown, recovery, and movement-prep priorities that support the plan and the stated limitations.",
  },
  {
    id: "nutrition_reviewer",
    title: "Nutrition reviewer",
    instruction:
      "Review nutrition and habit considerations that support the goal without prescribing medical nutrition therapy or unsafe restriction.",
  },
];

export type GenerateCoachingPlanInput = {
  intakePayload: JsonObject;
  mode: CoachingOrchestrationMode;
  providers?: CoachingAiProviderRegistry;
};

export type GenerateCoachingPlanResult = {
  plan: JsonObject;
  agentOutputs: JsonObject;
};

type StepRun = {
  step: CoachingStepId;
  title: string;
  content: string;
  provider: string;
  model: string;
};

function createDefaultProviderRegistry(): CoachingAiProviderRegistry {
  return {
    anthropic: createAnthropicProvider(),
    kimi: createKimiProvider(),
    openai: createOpenAiProvider(),
  };
}

function safeJsonParse(content: string): JsonValue | null {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fencedMatch?.[1] ?? content).trim();

  try {
    return JSON.parse(candidate) as JsonValue;
  } catch {
    return null;
  }
}

function completionToStepRun(
  step: CoachingStepId,
  title: string,
  completion: CoachingAiCompletion,
): StepRun {
  return {
    step,
    title,
    content: completion.content,
    provider: completion.provider,
    model: completion.model,
  };
}

function routingMetadata(mode: CoachingOrchestrationMode): JsonObject {
  return {
    mode,
    cheapAndHeavySteps: [
      "intake_compression",
      "medical_safety_screener",
      "physio_reviewer",
      "fitness_coach",
      "mobility_coach",
      "nutrition_reviewer",
      "panel_brief",
    ],
    cheapAndHeavyRoutes: getRoutesForStep("fitness_coach", mode).map((route) => ({ ...route })),
    finalModeratorRoutes: getRoutesForStep("final_moderator", mode).map((route) => ({ ...route })),
  };
}

export async function generateCoachingPlan({
  intakePayload,
  mode,
  providers = createDefaultProviderRegistry(),
}: GenerateCoachingPlanInput): Promise<GenerateCoachingPlanResult> {
  const intakeCompression = completionToStepRun(
    "intake_compression",
    "Intake compression",
    await runRoutedCompletion(providers, "intake_compression", mode, {
      temperature: 0,
      maxTokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You compress coaching intakes into a privacy-minimized structured brief. Preserve safety-relevant facts, goals, constraints, equipment, schedule, and missing information. Do not invent details.",
        },
        {
          role: "user",
          content: `Compress this raw intake into JSON with keys: clientProfile, goals, schedule, equipment, constraints, safetySignals, nutritionSignals, missingInformation, coachSummary. Raw intake:\n${JSON.stringify(
            intakePayload,
          )}`,
        },
      ],
    }),
  );
  const compressedIntake = safeJsonParse(intakeCompression.content) ?? {
    coachSummary: intakeCompression.content,
  };
  const compressedIntakeText = JSON.stringify(compressedIntake);

  const expertRuns: StepRun[] = [];

  for (const expert of EXPERT_STEPS) {
    const completion = await runRoutedCompletion(providers, expert.id, mode, {
      temperature: 0.2,
      maxTokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are the ${expert.title} in a coaching plan panel. ${expert.instruction} Return concise JSON with keys: findings, recommendations, risks, followUps.`,
        },
        {
          role: "user",
          content: `Use only this compressed intake brief. Do not request or rely on the full raw intake.\n${compressedIntakeText}`,
        },
      ],
    });

    expertRuns.push(completionToStepRun(expert.id, expert.title, completion));
  }

  const panelBrief = completionToStepRun(
    "panel_brief",
    "Panel brief",
    await runRoutedCompletion(providers, "panel_brief", mode, {
      temperature: 0.1,
      maxTokens: 1400,
      messages: [
        {
          role: "system",
          content:
            "You merge expert panel notes into a concise moderator brief. Highlight agreements, conflicts, safety gates, and the safest actionable plan direction. Return JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            compressedIntake,
            expertOutputs: expertRuns.map((run) => ({
              step: run.step,
              title: run.title,
              content: run.content,
            })),
          }),
        },
      ],
    }),
  );

  const finalModerator = completionToStepRun(
    "final_moderator",
    "Final moderator",
    await runRoutedCompletion(providers, "final_moderator", mode, {
      temperature: 0.1,
      maxTokens: 2200,
      messages: [
        {
          role: "system",
          content:
            "You are the final coaching plan moderator. Create a safe, practical, review-ready coaching plan from the compressed intake and panel brief. Include safety disclaimers where needed. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            compressedIntake,
            panelBrief: panelBrief.content,
          }),
        },
      ],
    }),
  );
  const finalPlan = safeJsonParse(finalModerator.content);

  return {
    plan: {
      version: 1,
      orchestrationMode: mode,
      source: "api/coaching/generate-plan",
      finalModerator: {
        provider: finalModerator.provider,
        model: finalModerator.model,
      },
      content:
        finalPlan && typeof finalPlan === "object" && !Array.isArray(finalPlan)
          ? finalPlan
          : { planText: finalModerator.content },
    },
    agentOutputs: {
      status: "generated",
      routing: routingMetadata(mode),
      intakeCompression: {
        provider: intakeCompression.provider,
        model: intakeCompression.model,
        content: intakeCompression.content,
      },
      compressedIntake,
      expertOutputs: expertRuns.map((run) => ({ ...run })),
      panelBrief: { ...panelBrief },
      finalModerator: { ...finalModerator },
      rawIntakeDistribution:
        "Raw intake is sent only to intake_compression; expert steps receive compressedIntake only.",
    },
  };
}
