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
  { step: "final_moderator", title: "Final moderator" },
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
    finalModeratorRoutes: getRoutesForStep("final_moderator", mode).map((route) => ({ ...route })),
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
  providers = createDefaultProviderRegistry(),
  onProgress,
}: GenerateCoachingPlanInput): Promise<GenerateCoachingPlanResult> {
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
            content:
              "You compress coaching intakes into a privacy-minimized structured brief. Preserve safety-relevant facts, goals, constraints, equipment, schedule, and missing information. Do not invent details. Return a single valid JSON object only with no markdown or commentary.",
          },
          {
            role: "user",
            content: `Compress this raw intake into JSON with keys: clientProfile, goals, schedule, equipment, constraints, safetySignals, nutritionSignals, missingInformation, coachSummary. Raw intake:\n${JSON.stringify(
              intakePayload,
            )}`,
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
        maxTokens: 1500,
        messages: [
          {
            role: "system",
            content: `You are the ${expert.title} in a coaching plan panel. ${expert.instruction} Return one strict JSON object only with keys: findings, recommendations, risks, followUps. Do not wrap the JSON in markdown.`,
          },
          {
            role: "user",
            content: `Use only this compressed intake brief. Do not request or rely on the full raw intake.\n${compressedIntakeText}`,
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
        maxTokens: 2000,
        messages: [
          {
            role: "system",
            content:
              "You merge expert panel notes into a concise moderator brief. Highlight agreements, conflicts, safety gates, and the safest actionable plan direction. Return one strict JSON object only with no markdown or commentary.",
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

  const finalModerator = completionToStepRun(
    "final_moderator",
    "Final moderator",
    await runStep(
      providers,
      "final_moderator",
      "Final moderator",
      mode,
      {
        temperature: 0.2,
        maxTokens: 3500,
        messages: [
          {
            role: "system",
            content: [
              "You are the final coaching plan moderator. Using the compressed intake and the panel",
              "brief, write a clear, encouraging, review-ready coaching plan in GitHub-flavored Markdown.",
              "",
              "Use exactly these `###` sections, in order:",
              "### Plan snapshot — 2–4 sentences tying the approach to the client's goal and constraints.",
              "### Weekly training schedule — a Markdown table with columns | Day | Focus | Key sessions |, one row per training day based on their availability.",
              "### Session blueprint — a bullet list: warm-up, main work, accessories, conditioning, cooldown.",
              "### Progression — how to progress over the next 4–8 weeks.",
              "### Mobility & recovery — a short bullet list.",
              "### Nutrition starting points — a short bullet list; respect stated restrictions; no medical nutrition therapy.",
              "### Safety notes — a Markdown blockquote (lines starting with >) covering any clearance/caution guidance and a reminder this is not medical advice.",
              "",
              "Rules: Use only the information provided — never invent medical facts. Use **bold** for key terms.",
              "Do NOT output a top-level title, a 'Part 2' header, JSON, or code fences around the document.",
              "Start directly with `### Plan snapshot`.",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              compressedIntake,
              panelBrief: panelBriefOutput,
            }),
          },
        ],
      },
      onProgress,
    ),
  );
  const planMarkdown = finalModerator.content.trim();

  return {
    plan: coachingPlanContentSchema.parse({
      version: 1,
      orchestrationMode: mode,
      source: "api/coaching/generate-plan",
      finalModerator: {
        provider: finalModerator.provider,
        model: finalModerator.model,
      },
      // The editable Markdown document is the source of truth now; `content` keeps a
      // lightweight marker so legacy structured-JSON consumers don't choke.
      content: { format: "markdown" },
    }),
    planMarkdown,
    agentOutputs: coachingAgentOutputsSchema.parse({
      status: "generated",
      routing: routingMetadata(mode),
      intakeCompression: {
        provider: intakeCompression.provider,
        model: intakeCompression.model,
        content: intakeCompression.content,
      },
      compressedIntake,
      expertOutputs,
      panelBrief: panelBriefOutput,
      finalModerator: { ...finalModerator },
      rawIntakeDistribution:
        "Raw intake is sent only to intake_compression; expert steps receive compressedIntake only.",
    }),
  };
}
