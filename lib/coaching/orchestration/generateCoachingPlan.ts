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
      "Design a concrete program direction: pick a specific training split and weekly frequency that fit the available days, equipment, and level; name the priority compound and accessory exercises the plan should include, and the exercises to avoid given any injuries; specify set, rep, and intensity (RPE/%1RM) schemes for the goal; and define a phase-by-phase progression model with deloads and measurable milestones.",
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
      "Give concrete nutrition direction: estimate a daily calorie and macro (protein/carbs/fat) target range for the goal and bodyweight; recommend a meal count and structure; list every allergy, intolerance, and dietary restriction to honor plus the liked foods to build around; and assess which eating approaches (e.g. intermittent fasting, meal frequency, carb cycling) suit or do not suit this client and why. Do not prescribe medical nutrition therapy or unsafe restriction.",
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

// Allowed plan durations (weeks) the admin can choose before generating.
export const PLAN_DURATION_WEEKS = [1, 4, 12, 24] as const;
export type PlanDurationWeeks = (typeof PLAN_DURATION_WEEKS)[number];
export const DEFAULT_PLAN_DURATION_WEEKS: PlanDurationWeeks = 12;

type PlanDurationDescriptor = {
  weeks: PlanDurationWeeks;
  label: string;
  // Instruction block injected into the training writer prompt describing how many phases to
  // write and how they progress. Nutrition reuses the same phase framing for calorie scaling.
  phaseGuidance: string;
  // Output budget for the training writer; longer programs need more room.
  trainingMaxTokens: number;
};

function normalizePlanDurationWeeks(value: number | undefined): PlanDurationWeeks {
  return (PLAN_DURATION_WEEKS as readonly number[]).includes(value ?? NaN)
    ? (value as PlanDurationWeeks)
    : DEFAULT_PLAN_DURATION_WEEKS;
}

function describePlanDuration(weeksInput: number | undefined): PlanDurationDescriptor {
  const weeks = normalizePlanDurationWeeks(weeksInput);

  switch (weeks) {
    case 1:
      return {
        weeks,
        label: "1 week (sample week)",
        phaseGuidance:
          "Write ONE fully detailed training week (no phases). After the week, add a short " +
          "**How to progress into week 2** note describing how to add load or reps next week.",
        trainingMaxTokens: 3500,
      };
    case 4:
      return {
        weeks,
        label: "4 weeks (1 month)",
        phaseGuidance:
          "Write a single **4-week mesocycle**: one detailed weekly template, explicit weekly " +
          "load/rep progression across weeks 1–3, and a **deload in week 4**.",
        trainingMaxTokens: 5000,
      };
    case 12:
      return {
        weeks,
        label: "12 weeks (3 months)",
        phaseGuidance:
          "Write **three 4-week phases** — **Phase 1 Foundation (weeks 1–4)**, **Phase 2 Build " +
          "(weeks 5–8)**, **Phase 3 Intensify (weeks 9–12)**. For each phase give the full weekly " +
          "template (day-by-day exercise tables), the within-phase weekly progression, and a " +
          "**deload at the end of each phase**. Show how exercise selection and intensity change " +
          "from phase to phase.",
        trainingMaxTokens: 7000,
      };
    case 24:
    default:
      return {
        weeks: 24,
        label: "24 weeks (6 months)",
        phaseGuidance:
          "Write **four phases across 24 weeks** — **Phase 1 Foundation (weeks 1–4)**, **Phase 2 " +
          "Hypertrophy (weeks 5–12)**, **Phase 3 Strength (weeks 13–20)**, **Phase 4 Peak/Refine " +
          "(weeks 21–24)** (adapt the emphasis to the client's goal). For each phase give the full " +
          "weekly template (day-by-day exercise tables), the within-phase weekly progression, and a " +
          "**deload at the end of each phase**, plus one planned recovery/reset week. Show how " +
          "exercise selection and intensity change from phase to phase.",
        trainingMaxTokens: 9000,
      };
  }
}

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
        maxTokens: 2200,
        messages: [
          {
            role: "system",
            content: `You are the ${expert.title} in a coaching plan panel. ${expert.instruction} Return one strict JSON object only with keys: findings, recommendations, risks, followUps. Be specific and concrete — name exercises, schemes, foods, and numbers where relevant. Do not wrap the JSON in markdown.`,
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
        maxTokens: 2500,
        messages: [
          {
            role: "system",
            content:
              "You merge expert panel notes into a concise moderator brief. Highlight agreements, conflicts, safety gates, and the safest actionable plan direction. Preserve the concrete training and nutrition specifics the experts provided (split, exercises, set/rep schemes, calorie/macro targets, suitable eating approaches) so the plan writers can act on them. Return one strict JSON object only with no markdown or commentary.",
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
            content: [
              "You are an elite strength & conditioning coach writing the TRAINING half of a",
              "client's coaching plan in GitHub-flavored Markdown. Use ONLY the compressed intake and",
              "panel brief. Respect every stated injury, equipment limit, available day, session",
              "length, and safety gate. Never invent medical facts. Match the depth of professional",
              "programs (e.g. Muscle & Strength routines): a named split, day-by-day exercise tables,",
              "and an explicit progression model.",
              "",
              `The client wants a **${planDuration.label}** program.`,
              "",
              "Write these `###` sections in order:",
              "",
              "### Plan snapshot",
              "2–4 sentences tying the approach to the goal, level, and constraints; state the chosen",
              "split (e.g. Push/Pull/Legs, Upper/Lower, Full Body) and weekly frequency.",
              "",
              "### Training overview",
              "Bullets: goal, training level, days/week, session length, equipment, split rationale.",
              "",
              planDuration.phaseGuidance,
              "",
              "For EACH phase output:",
              "- a `####` header with the week range and focus (e.g. \"#### Phase 1 — Foundation (Weeks 1–4)\").",
              "- for each training day a `#####` header (e.g. \"##### Day 1 — Upper (Strength)\") followed by",
              "  a Markdown table with columns: | Exercise | Sets | Reps | Rest | Tempo/RPE | Notes |.",
              "  Include 5–8 concrete, named exercises per day suited to the goal, level, equipment, and",
              "  constraints; give specific sets, rep ranges, rest, and an RPE or tempo, plus a coaching",
              "  cue or regression/progression in Notes.",
              "- a `**Warm-up:**` line, a `**Progression this phase:**` line (how to add load/reps week to",
              "  week), and a note on the deload week.",
              "",
              "### Session structure",
              "Bullets describing the universal flow of every session (general warm-up, specific ramp",
              "sets, main lifts, accessories, optional conditioning, cooldown) with time estimates that",
              "fit the client's session length.",
              "",
              "### Progression & milestones",
              "How the client advances across the whole program; measurable milestones tied to the goal;",
              "when to add load or retest; RPE/RIR autoregulation guidance.",
              "",
              "### Mobility & recovery",
              "Bullets: mobility/warm-up priorities, between-session recovery, sleep, and rehab-aware",
              "movement prep for any stated limitations.",
              "",
              "### Safety notes",
              "A Markdown blockquote (lines starting with >) covering clearance/caution from the safety",
              "gates and a reminder this is not medical advice.",
              "",
              "Rules: use **bold** for key terms; use real, specific exercises and real numbers — never",
              "vague phrases like \"do some sets\". Do NOT output a top-level # title or code fences around",
              "the document. Start directly with `### Plan snapshot`.",
            ].join("\n"),
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
            content: [
              "You are a dietitian-style nutrition coach writing the NUTRITION half of a client's",
              "coaching plan in GitHub-flavored Markdown. Use ONLY the compressed intake and panel",
              "brief. Honor every allergy, intolerance, dietary restriction, and disliked food; prefer",
              "foods the client already likes. Do NOT prescribe medical nutrition therapy or unsafe",
              "restriction.",
              "",
              `This nutrition plan supports a **${planDuration.label}** training program.`,
              "",
              "Write these `###` sections in order:",
              "",
              "### Nutrition snapshot",
              "2–4 sentences tying the approach to the goal, current habits, and constraints.",
              "",
              "### Daily targets",
              "Estimated daily calories + macro targets (protein/carbs/fat in grams) as a small table or",
              "bullets; one line on how they were estimated (tie protein to bodyweight) and that they are",
              "starting points to adjust.",
              "",
              "### Weekly meal plan (Monday–Friday)",
              "A Markdown table with columns | Meal | Mon | Tue | Wed | Thu | Fri | and rows: Breakfast,",
              "Lunch, Dinner, Snack 1, Snack 2. Each cell is a concrete meal with an approximate portion",
              "(and rough calories). Honor all restrictions and use liked foods. Keep meals realistic and",
              "repeatable.",
              "",
              "### Weekend & flexibility",
              "Bullets: lighter Saturday/Sunday guidance, eating out, and one flexible/treat slot to",
              "support adherence.",
              "",
              "### Alternative approaches",
              "2–3 optional eating styles with who they suit plus a one-line pro/con and safety caveat,",
              "e.g. **Intermittent fasting (16:8)**, **3 meals vs 5 small meals**, **carb cycling around",
              "training days**. Recommend the best fit for THIS client.",
              "",
              "### Adjusting over time",
              "How to scale calories/portions across the program phases as bodyweight and performance",
              "change (e.g. recalibrate every 3–4 weeks); simple progress signals to watch.",
              "",
              "### Hydration & habits",
              "Bullets: water target; caffeine/alcohol notes aligned to the intake; 2–3 keystone habits.",
              "",
              "### Nutrition safety notes",
              "A Markdown blockquote (lines starting with >): general wellness guidance, not medical",
              "nutrition therapy; consult a professional for clinical conditions or allergies.",
              "",
              "Rules: use **bold** for key terms; use concrete foods and real numbers; honor every",
              "allergy/intolerance/restriction. Do NOT output a top-level # title or code fences. Start",
              "directly with `### Nutrition snapshot`.",
            ].join("\n"),
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
