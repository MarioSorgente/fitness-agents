/**
 * Plan duration → phased-program guidance.
 *
 * The `phaseGuidance` strings below are PROMPT TEXT injected into the training plan writer
 * (and referenced by the nutrition writer for calorie scaling). Tweak the phase wording here to
 * change how long programs are structured. The numeric `trainingMaxTokens` is an output budget,
 * not prompt text — raise it if longer programs get cut off.
 */

// Allowed plan durations (weeks) the admin can choose before generating.
export const PLAN_DURATION_WEEKS = [1, 4, 12, 24] as const;
export type PlanDurationWeeks = (typeof PLAN_DURATION_WEEKS)[number];
export const DEFAULT_PLAN_DURATION_WEEKS: PlanDurationWeeks = 12;

export type PlanDurationDescriptor = {
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

export function describePlanDuration(weeksInput: number | undefined): PlanDurationDescriptor {
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
