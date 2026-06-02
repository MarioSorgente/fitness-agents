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
import {
  expertOutputSchema,
  panelBriefSchema,
  type ExpertOutput,
  type PanelBrief,
} from "../schemas/expertOutputSchema";
import {
  coachingAgentOutputsSchema,
  coachingPlanContentSchema,
  type CoachingAgentOutputs,
  type CoachingPlanContent,
} from "../schemas/coachingPlanSchema";
import type { CoachingIntake, JsonObject, JsonValue } from "../schemas/intakeSchema";
// All agent prompt text lives under ../prompts (one file per agent). This file only sequences
// the steps; edit wording there, not here.
import {
  buildExpertSystemPrompt,
  buildExpertUserPrompt,
  buildIntakeCompressionUserPrompt,
  buildNutritionPlanWriterSystemPrompt,
  buildTrainingPlanWriterSystemPrompt,
  describePlanDuration,
  EXPERT_STEPS,
  intakeCompressionSystemPrompt,
  panelBriefSystemPrompt,
} from "../prompts";

// Re-export the plan-duration config so existing importers (e.g. the generate-plan route) keep
// working after the prompt text moved to ../prompts/shared/planDuration.
export {
  PLAN_DURATION_WEEKS,
  DEFAULT_PLAN_DURATION_WEEKS,
  type PlanDurationWeeks,
} from "../prompts";

export type CoachingProgressEvent =
  | { kind: "step_started"; step: CoachingStepId; title: string }
  | {
      kind: "step_completed";
      step: CoachingStepId;
      title: string;
      provider: string;
      model: string;
      durationMs: number;
    }
  | {
      kind: "step_failed";
      step: CoachingStepId;
      title: string;
      error: string;
      durationMs: number;
    };

export type GenerateCoachingPlanInput = {
  intakePayload: CoachingIntake;
  mode: CoachingOrchestrationMode;
  // How long a program to write (1, 4, 12, or 24 weeks). Drives the phased structure.
  planDurationWeeks?: number;
  providers?: CoachingAiProviderRegistry;
  onProgress?: (event: CoachingProgressEvent) => void;
};

export type GenerateCoachingPlanResult = {
  plan: CoachingPlanContent;
  agentOutputs: CoachingAgentOutputs;
  // AI-authored coaching plan as Markdown (Part 2 of the editable document).
  planMarkdown: string;
};

export const COACHING_AGENT_TIMELINE: ReadonlyArray<{ step: CoachingStepId; title: string }> = [
  { step: "intake_compression", title: "Intake compression" },
  { step: "medical_safety_screener", title: "Medical safety screener" },
  { step: "physio_reviewer", title: "Physio reviewer" },
  { step: "fitness_coach", title: "Fitness coach" },
  { step: "mobility_coach", title: "Mobility coach" },
  { step: "nutrition_reviewer", title: "Nutrition reviewer" },
  { step: "panel_brief", title: "Panel brief" },
  { step: "training_plan_writer", title: "Training plan writer" },
  { step: "nutrition_plan_writer", title: "Nutrition plan writer" },
];

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

function normalizeStringArray(value: JsonValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function objectValue(value: JsonValue | null): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stepRunToExpertOutput(run: StepRun): ExpertOutput {
  const parsed = objectValue(safeJsonParse(run.content));
  const parsedJson = Object.keys(parsed).length > 0;

  return expertOutputSchema.parse({
    ...parsed,
    step: run.step,
    title: run.title,
    provider: run.provider,
    model: run.model,
    findings: parsedJson
      ? normalizeStringArray(parsed.findings)
      : [`${run.title} returned non-JSON content; raw content is retained for coach review.`],
    recommendations: normalizeStringArray(parsed.recommendations),
    risks: normalizeStringArray(parsed.risks),
    followUps: parsedJson
      ? normalizeStringArray(parsed.followUps)
      : ["Review this agent output manually before relying on it."],
    content: run.content,
    validationStatus: parsedJson ? "parsed" : "fallback_non_json",
  });
}

function stepRunToPanelBrief(run: StepRun, expertOutputs: ExpertOutput[]): PanelBrief {
  const parsed = objectValue(safeJsonParse(run.content));
  const parsedJson = Object.keys(parsed).length > 0;

  return panelBriefSchema.parse({
    ...parsed,
    agreements: parsedJson
      ? normalizeStringArray(parsed.agreements)
      : ["Panel brief returned non-JSON content; raw content is retained for coach review."],
    conflicts: normalizeStringArray(parsed.conflicts),
    safetyGates: normalizeStringArray(parsed.safetyGates),
    planDirection: normalizeStringArray(parsed.planDirection),
    expertOutputs,
    content: run.content,
    validationStatus: parsedJson ? "parsed" : "fallback_non_json",
  });
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
    finalWriterRoutes: getRoutesForStep("training_plan_writer", mode).map((route) => ({ ...route })),
  };
}

async function runStep(
  providers: CoachingAiProviderRegistry,
  step: CoachingStepId,
  title: string,
  mode: CoachingOrchestrationMode,
  request: Parameters<typeof runRoutedCompletion>[3],
  onProgress?: (event: CoachingProgressEvent) => void,
): Promise<CoachingAiCompletion> {
  onProgress?.({ kind: "step_started", step, title });
  const startedAt = Date.now();
  try {
    const completion = await runRoutedCompletion(providers, step, mode, request);
    onProgress?.({
      kind: "step_completed",
      step,
      title,
      provider: completion.provider,
      model: completion.model,
      durationMs: Date.now() - startedAt,
    });
    return completion;
  } catch (error) {
    onProgress?.({
      kind: "step_failed",
      step,
      title,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

export async function generateCoachingPlan({
  intakePayload,
  mode,
  planDurationWeeks,
  providers = createDefaultProviderRegistry(),
  onProgress,
}: GenerateCoachingPlanInput): Promise<GenerateCoachingPlanResult> {
  const planDuration = describePlanDuration(planDurationWeeks);

  const intakeCompression = completionToStepRun(
    "intake_compression",
    "Intake compression",
    await runStep(
      providers,
      "intake_compression",
      "Intake compression",
      mode,
      {
        temperature: 0,
        maxTokens: 1800,
        messages: [
          {
            role: "system",
            content: intakeCompressionSystemPrompt,
          },
          {
            role: "user",
            content: buildIntakeCompressionUserPrompt(intakePayload),
          },
        ],
      },
      onProgress,
    ),
  );
  const compressedIntake = objectValue(safeJsonParse(intakeCompression.content));
  if (Object.keys(compressedIntake).length === 0) {
    compressedIntake.coachSummary = intakeCompression.content;
  }
  const compressedIntakeText = JSON.stringify(compressedIntake);

  const expertRuns: StepRun[] = [];

  for (const expert of EXPERT_STEPS) {
    const completion = await runStep(
      providers,
      expert.id,
      expert.title,
      mode,
      {
        temperature: 0.2,
        maxTokens: 2200,
        messages: [
          {
            role: "system",
            content: buildExpertSystemPrompt(expert.title, expert.instruction),
          },
          {
            role: "user",
            content: buildExpertUserPrompt(compressedIntakeText),
          },
        ],
      },
      onProgress,
    );

    expertRuns.push(completionToStepRun(expert.id, expert.title, completion));
  }

  const expertOutputs = expertRuns.map(stepRunToExpertOutput);

  const panelBrief = completionToStepRun(
    "panel_brief",
    "Panel brief",
    await runStep(
      providers,
      "panel_brief",
      "Panel brief",
      mode,
      {
        temperature: 0.1,
        maxTokens: 2500,
        messages: [
          {
            role: "system",
            content: panelBriefSystemPrompt,
          },
          {
            role: "user",
            content: JSON.stringify({
              compressedIntake,
              expertOutputs,
            }),
          },
        ],
      },
      onProgress,
    ),
  );

  const panelBriefOutput = stepRunToPanelBrief(panelBrief, expertOutputs);

  // Shared context for both writers. They receive the panel brief and the chosen duration so
  // they prescribe a complete, phased program rather than a vague outline.
  const writerUserMessage = JSON.stringify({
    compressedIntake,
    panelBrief: panelBriefOutput,
    planDuration: { weeks: planDuration.weeks, label: planDuration.label },
  });

  const trainingPlanWriter = completionToStepRun(
    "training_plan_writer",
    "Training plan writer",
    await runStep(
      providers,
      "training_plan_writer",
      "Training plan writer",
      mode,
      {
        temperature: 0.3,
        maxTokens: planDuration.trainingMaxTokens,
        messages: [
          {
            role: "system",
            content: buildTrainingPlanWriterSystemPrompt(planDuration),
          },
          {
            role: "user",
            content: writerUserMessage,
          },
        ],
      },
      onProgress,
    ),
  );

  const nutritionPlanWriter = completionToStepRun(
    "nutrition_plan_writer",
    "Nutrition plan writer",
    await runStep(
      providers,
      "nutrition_plan_writer",
      "Nutrition plan writer",
      mode,
      {
        temperature: 0.3,
        maxTokens: 5500,
        messages: [
          {
            role: "system",
            content: buildNutritionPlanWriterSystemPrompt(planDuration),
          },
          {
            role: "user",
            content: writerUserMessage,
          },
        ],
      },
      onProgress,
    ),
  );

  // Assemble the two halves into the single Part 2 plan body (intake summary + disclaimer are
  // added by assemblePlanDocument upstream). Both halves use `###` sections so they read as one
  // consistent document; a rule separates training from nutrition.
  const planMarkdown = [
    trainingPlanWriter.content.trim(),
    "",
    "---",
    "",
    nutritionPlanWriter.content.trim(),
  ].join("\n");

  return {
    plan: coachingPlanContentSchema.parse({
      version: 1,
      orchestrationMode: mode,
      source: "api/coaching/generate-plan",
      planDurationWeeks: planDuration.weeks,
      // Kept for back-compat with consumers that read `finalModerator`; points at the writer
      // that authors the lead (training) half of the document.
      finalModerator: {
        provider: trainingPlanWriter.provider,
        model: trainingPlanWriter.model,
      },
      trainingPlanWriter: {
        provider: trainingPlanWriter.provider,
        model: trainingPlanWriter.model,
      },
      nutritionPlanWriter: {
        provider: nutritionPlanWriter.provider,
        model: nutritionPlanWriter.model,
      },
      // The editable Markdown document is the source of truth now; `content` keeps a
      // lightweight marker so legacy structured-JSON consumers don't choke.
      content: { format: "markdown" },
    }),
    planMarkdown,
    agentOutputs: coachingAgentOutputsSchema.parse({
      status: "generated",
      routing: routingMetadata(mode),
      planDurationWeeks: planDuration.weeks,
      intakeCompression: {
        provider: intakeCompression.provider,
        model: intakeCompression.model,
        content: intakeCompression.content,
      },
      compressedIntake,
      expertOutputs,
      panelBrief: panelBriefOutput,
      trainingPlanWriter: { ...trainingPlanWriter },
      nutritionPlanWriter: { ...nutritionPlanWriter },
      rawIntakeDistribution:
        "Raw intake is sent only to intake_compression; expert steps receive compressedIntake only.",
    }),
  };
}
