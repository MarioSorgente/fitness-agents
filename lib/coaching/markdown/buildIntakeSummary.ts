import type { CoachingIntake } from "../schemas/intakeSchema";

/**
 * Deterministic, accurate Markdown summary of a client's intake answers.
 *
 * Built straight from the submitted payload (never from an LLM) so that
 * health, safety, and medical facts are always faithful. Returns the body of
 * "Part 1" as a set of `###` subsections; the document title and the
 * `## Part 1 …` header are added by the assembler.
 */

type Dict = Record<string, unknown>;

type YesNo = { answer?: string; explanation?: string };

function str(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function humanize(value: unknown): string {
  const text = str(value);
  if (!text) return "";
  const spaced = text.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function humanizeList(value: unknown): string {
  if (!Array.isArray(value)) return humanize(value);
  return value
    .map((item) => humanize(item))
    .filter(Boolean)
    .join(", ");
}

function yesNo(value: unknown): YesNo | undefined {
  if (typeof value === "string") {
    return value === "yes" || value === "no" ? { answer: value } : undefined;
  }
  if (value && typeof value === "object" && "answer" in value) {
    return value as YesNo;
  }
  return undefined;
}

/** Render a labelled fact line, returning null when there's nothing to show. */
function fact(label: string, value: unknown): string | null {
  const text = Array.isArray(value) ? humanizeList(value) : (str(value) ?? "");
  return text ? `- **${label}:** ${text}` : null;
}

function rawFact(label: string, value: string | undefined): string | null {
  return value && value.trim() ? `- **${label}:** ${value.trim()}` : null;
}

/** Render a yes/no(/explanation) answer, optionally flagging "yes" as notable. */
function yesNoLine(label: string, value: unknown, flagYes = false): string | null {
  const answer = yesNo(value);
  if (!answer?.answer) return null;
  const marker = flagYes && answer.answer === "yes" ? "⚠️ " : "";
  const explanation = str(answer.explanation);
  const suffix = explanation ? ` — ${explanation}` : "";
  return `- ${marker}**${label}:** ${humanize(answer.answer)}${suffix}`;
}

function block(heading: string, lines: Array<string | null>): string | null {
  const kept = lines.filter((line): line is string => Boolean(line));
  if (kept.length === 0) return null;
  return `### ${heading}\n\n${kept.join("\n")}`;
}

const SAFETY_STATUS_LABEL: Record<string, string> = {
  clear: "Clear",
  caution: "Caution",
  medical_clearance_recommended: "Medical clearance recommended",
};

const PAR_Q_FIELDS: Array<[string, string]> = [
  ["diagnosedHeartConditionAndOnlySupervisedActivity", "Heart condition / supervised activity only"],
  ["bloodPressureOrHeartMedication", "Blood pressure or heart medication"],
  ["chestPainDuringActivity", "Chest pain during activity"],
  ["dizzinessOrLossOfConsciousnessLast12Months", "Dizziness / loss of consciousness (12 mo)"],
  ["boneJointSoftTissueProblemAggravatedByActivity", "Bone/joint/soft-tissue problem aggravated by activity"],
  ["chestPainLast30Days", "Chest pain in the last 30 days"],
  ["otherReasonNotToExercise", "Other reason not to exercise"],
  ["currentlyFeelingUnwell", "Currently feeling unwell"],
  ["pregnancyOrPossiblePregnancy", "Pregnancy or possible pregnancy"],
  ["recentHealthChange", "Recent health change"],
];

const CARDIO_FIELDS: Array<[string, string]> = [
  ["highBloodPressure", "High blood pressure"],
  ["hypertension", "Hypertension"],
  ["highCholesterol", "High cholesterol"],
  ["hyperlipidemia", "Hyperlipidemia"],
  ["heartDisease", "Heart disease"],
  ["skippedHeartbeat", "Skipped heartbeat"],
  ["heartAttack", "Heart attack"],
  ["stroke", "Stroke"],
  ["bypassOrCardiacSurgery", "Bypass / cardiac surgery"],
  ["angina", "Angina"],
  ["gout", "Gout"],
  ["phlebitisOrEmbolism", "Phlebitis / embolism"],
  ["otherCardiovascularCondition", "Other cardiovascular condition"],
];

export function buildIntakeSummaryMarkdown(intake: CoachingIntake): string {
  const input = intake as unknown as Dict;

  const profile = block("Profile", [
    fact("Name", input.fullName),
    fact("Age", input.age),
    fact("Sex", humanize(input.sex)),
    fact("Height", input.height),
    fact("Weight", input.weight),
    fact("Email", input.email),
    fact("Phone", input.phoneNumber),
  ]);

  const goals = block("Goals & motivation", [
    fact("Primary goal", humanize(input.mainGoal)),
    rawFact("In their words", str(input.specificGoalDescription)),
    fact("Secondary goals", input.secondaryGoals),
    fact("Goal priority", humanize(input.goalPriority)),
    rawFact("Desired outcome", str(input.desiredOutcome)),
    rawFact("Motivation", str(input.motivation)),
    rawFact("Biggest struggle", str(input.biggestStruggle)),
    fact("Confidence (1–10)", input.confidenceLevel),
    fact("Preferred coaching style", input.preferredCoachingStyle),
  ]);

  const training = block("Training background", [
    fact("Experience level", humanize(input.trainingLevel)),
    rawFact("Current weekly activity", str(input.currentWeeklyActivity)),
    fact("Available days/week", input.availableDaysPerWeek),
    fact("Preferred days", input.preferredTrainingDays),
    fact("Session length (min)", input.sessionDurationMinutes),
    fact("Training location", humanize(input.trainingLocation)),
    fact("Equipment available", input.equipmentAvailable),
    rawFact("Current program", str(input.currentProgram)),
    rawFact("Enjoys", str(input.likedExercises)),
    rawFact("Dislikes", str(input.dislikedExercises)),
    rawFact("Movements that feel good", str(input.movementsThatFeelGood)),
    rawFact("Exercises that cause pain", str(input.exercisesThatCausePain)),
  ]);

  const safetyStatus = str(input.safetyStatus) ?? "clear";
  const healthSafety = block("Health & safety (PAR-Q)", [
    `- **Derived safety status:** ${SAFETY_STATUS_LABEL[safetyStatus] ?? humanize(safetyStatus)}`,
    ...PAR_Q_FIELDS.map(([key, label]) => yesNoLine(label, input[key], true)),
  ]);

  const medications = Array.isArray(input.medications)
    ? (input.medications as Dict[])
        .map((med) => {
          const name = str(med.medicationName);
          if (!name) return null;
          const extras = [str(med.dosage), str(med.frequency), str(med.conditionOrReason)]
            .filter(Boolean)
            .join(", ");
          return `- **${name}**${extras ? ` — ${extras}` : ""}`;
        })
        .filter(Boolean)
    : [];

  const conditions = Array.isArray(input.diagnosedConditions)
    ? (input.diagnosedConditions as Dict[])
        .map((cond) => {
          const name = str(cond.conditionName);
          if (!name) return null;
          const extras = [str(cond.dateOfDiagnosis), str(cond.notes)].filter(Boolean).join(", ");
          return `- **${name}**${extras ? ` — ${extras}` : ""}`;
        })
        .filter(Boolean)
    : [];

  const surgeries = Array.isArray(input.surgeries)
    ? (input.surgeries as Dict[])
        .map((surgery) => {
          const type = str(surgery.surgeryType) ?? str(surgery.bodyArea);
          if (!type) return null;
          const extras = [str(surgery.bodyArea), str(surgery.date), str(surgery.currentLimitations)]
            .filter(Boolean)
            .join(", ");
          return `- **${type}**${extras ? ` — ${extras}` : ""}`;
        })
        .filter(Boolean)
    : [];

  const cardioFlags = CARDIO_FIELDS.map(([key, label]) => {
    const answer = yesNo(input[key]);
    return answer?.answer === "yes" ? yesNoLine(label, answer, true) : null;
  });

  const medicalHistory = block("Medical history", [
    ...(medications.length ? ["**Medications:**", ...medications] : [rawFact("Medications", "None reported")]),
    rawFact("Allergies", str(input.allergies)),
    ...(conditions.length ? ["**Diagnosed conditions:**", ...conditions] : []),
    rawFact("Other diagnosed conditions", str(input.otherDiagnosedConditions)),
    ...(surgeries.length ? ["**Surgeries:**", ...surgeries] : []),
    ...(cardioFlags.some(Boolean) ? ["**Cardiovascular flags (Yes):**", ...cardioFlags] : []),
    yesNoLine("Currently under physio/doctor care", input.currentPhysioOrDoctorCare, true),
  ]);

  const painAreas = Array.isArray(input.painAreas)
    ? (input.painAreas as Dict[])
        .map((pain) => {
          const area = humanize(pain.area);
          if (!area) return null;
          const severity = str(pain.severity);
          const parts = [
            severity ? `severity ${severity}/10` : undefined,
            str(pain.description),
            str(pain.triggers) ? `triggers: ${str(pain.triggers)}` : undefined,
            str(pain.movementsThatMakeItBetter)
              ? `eases with: ${str(pain.movementsThatMakeItBetter)}`
              : undefined,
          ].filter(Boolean);
          return `- **${area}**${parts.length ? ` — ${parts.join("; ")}` : ""}`;
        })
        .filter(Boolean)
    : [];

  const painInjuries = block("Pain & injuries", [
    ...(painAreas.length ? painAreas : [rawFact("Reported pain areas", "None reported")]),
    yesNoLine("Limitations aggravated by exercise", input.physicalLimitationsAggravatedByExercise, true),
    rawFact("Movements/positions avoided", str(input.movementsExercisesPositionsAvoided)),
    yesNoLine("Told to avoid activities", input.toldToAvoidActivities, true),
    rawFact("Known diagnoses", str(input.knownDiagnoses)),
  ]);

  const lifestyle = block("Lifestyle & mindset", [
    fact("Smoking", humanize(input.smoking)),
    fact("Caffeine", humanize(input.caffeine)),
    fact("Alcohol", humanize(input.alcohol)),
    fact("Sleep", humanize(input.sleepHours)),
    fact("Sleep quality", humanize(input.sleepQuality)),
    fact("Energy level", humanize(input.energyLevel)),
    fact("Work stress", humanize(input.stressWork)),
    fact("Home stress", humanize(input.stressHome)),
    fact("Consistency challenges", input.consistencyChallenges),
    fact("Accountability preference", input.accountabilityPreference),
    rawFact("Mood around fitness", str(input.currentMoodAroundFitness)),
    rawFact("Realistic plan requirements", str(input.realisticPlanRequirements)),
    rawFact("Anything else for the coach", str(input.anythingElseForCoach)),
  ]);

  const nutrition = block("Nutrition", [
    rawFact("Current nutrition behavior", str(input.currentNutritionBehavior)),
    rawFact("Dietary restrictions", str(input.dietaryRestrictions)),
    rawFact("Food allergies", str(input.foodAllergies)),
    rawFact("Food intolerances", str(input.foodIntolerances)),
    rawFact("Foods loved", str(input.foodsLoved)),
    rawFact("Foods avoided/disliked", [str(input.foodsAvoided), str(input.foodsDisliked)].filter(Boolean).join("; ")),
    fact("Meals per day", input.mealsPerDay),
    fact("Appetite level", humanize(input.appetiteLevel)),
    rawFact("Water intake", str(input.waterIntake)),
    yesNoLine("Recent weight change", input.recentWeightChange),
  ]);

  return [
    profile,
    goals,
    training,
    healthSafety,
    medicalHistory,
    painInjuries,
    lifestyle,
    nutrition,
  ]
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
}
