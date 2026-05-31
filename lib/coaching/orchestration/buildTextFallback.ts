import type { CoachingIntake } from "../schemas/intakeSchema";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function bullet(items: Array<string | undefined>): string {
  const cleaned = items.filter((item): item is string => Boolean(item));
  if (cleaned.length === 0) return "_None provided._";
  return cleaned.map((item) => `- ${item}`).join("\n");
}

function suggestedSplit(days: number): string[] {
  if (days <= 1) return ["Full-body session"];
  if (days === 2) return ["Upper body + core", "Lower body + conditioning"];
  if (days === 3)
    return ["Push (chest, shoulders, triceps)", "Pull (back, biceps)", "Legs + core"];
  if (days === 4)
    return [
      "Upper body strength",
      "Lower body strength",
      "Upper body accessory + mobility",
      "Lower body accessory + conditioning",
    ];
  return [
    "Push strength",
    "Pull strength",
    "Legs",
    "Upper accessory",
    "Conditioning + mobility",
    ...Array.from({ length: Math.max(0, days - 5) }, (_, i) => `Recovery / optional day ${i + 1}`),
  ];
}

export function buildCoachingTextFallback(
  intake: CoachingIntake,
  reason: string,
): string {
  const input = intake as Record<string, unknown>;
  const fullName = asString(input.fullName) ?? "Client";
  const mainGoal = asString(input.mainGoal) ?? "general fitness";
  const goalDescription = asString(input.specificGoalDescription);
  const secondaryGoals = asStringArray(input.secondaryGoals);
  const trainingLevel = asString(input.trainingLevel) ?? "unspecified";
  const days = Number(input.availableDaysPerWeek) || 3;
  const session = asString(input.sessionDurationMinutes) ?? String(input.sessionDurationMinutes ?? "45");
  const equipment = asStringArray(input.equipmentAvailable);
  const constraints = [
    asString(input.exercisesThatCausePain),
    asString(input.movementsExercisesPositionsAvoided),
    asString(input.knownDiagnoses),
  ];
  const nutrition = asString(input.currentNutritionBehavior);
  const dietary = asString(input.dietaryRestrictions);
  const safetyStatus = asString(input.safetyStatus) ?? "clear";

  const split = suggestedSplit(days);
  const weeklyPlan = split.map((day, index) => `Day ${index + 1} — ${day}`).join("\n");

  return [
    `# Coaching plan (text fallback) for ${fullName}`,
    "",
    `_Generated without AI assistance because: ${reason}._`,
    "",
    "## Snapshot",
    bullet([
      `Primary goal: ${mainGoal.replace(/_/g, " ")}`,
      goalDescription ? `Goal detail: ${goalDescription}` : undefined,
      secondaryGoals.length > 0
        ? `Secondary goals: ${secondaryGoals.map((g) => g.replace(/_/g, " ")).join(", ")}`
        : undefined,
      `Training level: ${trainingLevel.replace(/_/g, " ")}`,
      `Availability: ${days} day(s) per week, ${session} minute sessions`,
      equipment.length > 0
        ? `Equipment: ${equipment.map((e) => e.replace(/_/g, " ")).join(", ")}`
        : "Equipment: bodyweight only",
      `Safety status: ${safetyStatus.replace(/_/g, " ")}`,
    ]),
    "",
    "## Suggested weekly structure",
    weeklyPlan,
    "",
    "## Session template",
    bullet([
      "5–8 min general warm-up (light cardio + dynamic mobility)",
      "2–3 main strength movements, 3–4 sets of 6–10 reps with a 1–2 RIR buffer",
      "2 accessory movements, 2–3 sets of 10–15 reps",
      "Optional 5–10 min conditioning finisher at a moderate effort",
      "5 min cooldown: easy breathing + static stretches for the day's movers",
    ]),
    "",
    "## Constraints to respect",
    bullet(constraints),
    "",
    "## Nutrition starting points",
    bullet([
      nutrition ? `Current pattern: ${nutrition}` : undefined,
      dietary ? `Restrictions: ${dietary}` : undefined,
      "Anchor each meal around a protein source and a vegetable",
      "Aim for ~0.7–1.0 g of protein per pound of bodyweight if appropriate",
      "Hydrate consistently across the day",
      "Keep one flexible meal slot to support adherence",
    ]),
    "",
    "## Safety disclaimers",
    bullet([
      "This text plan is educational wellness support, not medical advice or physical therapy.",
      "Stop any movement that causes sharp pain or unusual symptoms and seek qualified help.",
      safetyStatus !== "clear"
        ? "Your intake flagged a safety concern — consider a clinician check-in before progressing intensity."
        : undefined,
      "Re-run plan generation once AI providers are available to receive the full multi-agent plan.",
    ]),
  ].join("\n");
}
