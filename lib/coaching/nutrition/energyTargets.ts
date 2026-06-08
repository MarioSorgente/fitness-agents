/**
 * Deterministic calorie + macro engine.
 *
 * WHY THIS EXISTS: calorie/macro targets used to be invented by the LLM with no formula, no sex
 * term, and no sanity bounds — so a 60 kg woman could be handed ~2700 kcal/day. This module computes
 * the numbers in code from the RAW intake (sex, age, height, weight, goal, activity), applies hard
 * floors/ceilings, and hands the writers a fixed, category-aware target to build meals around.
 *
 * It is pure (no I/O) and never throws: any missing/implausible input degrades to `computable:false`
 * with a stated assumption, and the nutrition prompt falls back to an explained estimate.
 *
 * Formula: Mifflin-St Jeor BMR → activity multiplier → goal adjustment → sanity bounds → macros.
 */
import type { CoachingIntake } from "../schemas/intakeSchema";

export type Sex = "male" | "female" | "unknown";
export type BmiCategory = "underweight" | "normal" | "overweight" | "obese" | "unknown";

export type EnergyTargets = {
  /** True only when age + height + weight were all parseable; false → writers estimate instead. */
  computable: boolean;
  sex: Sex;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  bmiCategory: BmiCategory;
  bmr: number | null;
  activityMultiplier: number | null;
  tdee: number | null;
  /** Goal adjustment applied to TDEE, e.g. -0.15 = a 15% deficit, +0.1 = a 10% surplus. */
  goalAdjustmentPct: number | null;
  targetCalories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  /** One-line, plain-language summary the coach can paraphrase for the client. */
  method: string;
  /** Every fallback or clamp we applied, surfaced so the plan can be honest about assumptions. */
  assumptions: string[];
};

// ── Plausible ranges (out-of-range parses are treated as missing) ─────────────────────────────
const HEIGHT_CM_MIN = 120;
const HEIGHT_CM_MAX = 230;
const WEIGHT_KG_MIN = 30;
const WEIGHT_KG_MAX = 300;
const AGE_MIN = 13;
const AGE_MAX = 100;

const LB_TO_KG = 0.45359237;
const STONE_TO_KG = 6.35029318;
const HEALTHY_BMI_CEILING = 24.9;

function toNumber(raw: string): number | null {
  const value = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function inRange(value: number | null, min: number, max: number): number | null {
  return value !== null && value >= min && value <= max ? value : null;
}

export function parseSex(raw: string | undefined | null): Sex {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "male" || value === "m" || value === "man") return "male";
  if (value === "female" || value === "f" || value === "woman") return "female";
  return "unknown";
}

export function parseHeightCm(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();

  // Feet/inches — require an explicit foot marker so a bare "511" is never read as 5'11".
  const ftIn = value.match(/(\d+(?:[.,]\d+)?)\s*(?:'|ft|feet|foot)\s*(\d+(?:[.,]\d+)?)?/);
  if (ftIn) {
    const feet = toNumber(ftIn[1]) ?? 0;
    const inches = ftIn[2] ? (toNumber(ftIn[2]) ?? 0) : 0;
    return inRange((feet * 12 + inches) * 2.54, HEIGHT_CM_MIN, HEIGHT_CM_MAX);
  }

  const cm = value.match(/(\d+(?:[.,]\d+)?)\s*cm\b/);
  if (cm) return inRange(toNumber(cm[1]), HEIGHT_CM_MIN, HEIGHT_CM_MAX);

  const mm = value.match(/(\d+(?:[.,]\d+)?)\s*mm\b/);
  if (mm) {
    const millimetres = toNumber(mm[1]);
    return inRange(millimetres === null ? null : millimetres / 10, HEIGHT_CM_MIN, HEIGHT_CM_MAX);
  }

  const metres = value.match(/(\d+(?:[.,]\d+)?)\s*m(?:eters?|etres?)?\b/);
  if (metres) {
    const v = toNumber(metres[1]);
    if (v === null) return null;
    return inRange(v < 3 ? v * 100 : v, HEIGHT_CM_MIN, HEIGHT_CM_MAX);
  }

  const bare = toNumber(value);
  if (bare === null) return null;
  if (bare >= 1.2 && bare <= 2.5) return inRange(bare * 100, HEIGHT_CM_MIN, HEIGHT_CM_MAX);
  return inRange(bare, HEIGHT_CM_MIN, HEIGHT_CM_MAX);
}

export function parseWeightKg(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();

  const kg = value.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilo|kilos|kilograms?)\b/);
  if (kg) return inRange(toNumber(kg[1]), WEIGHT_KG_MIN, WEIGHT_KG_MAX);

  const lb = value.match(/(\d+(?:[.,]\d+)?)\s*(?:lb|lbs|pound|pounds)\b/);
  if (lb) {
    const pounds = toNumber(lb[1]);
    return inRange(pounds === null ? null : pounds * LB_TO_KG, WEIGHT_KG_MIN, WEIGHT_KG_MAX);
  }

  const stone = value.match(
    /(\d+(?:[.,]\d+)?)\s*(?:st|stone|stones)\b(?:\s*(\d+(?:[.,]\d+)?)\s*(?:lb|lbs|pound|pounds)?)?/,
  );
  if (stone) {
    const st = toNumber(stone[1]) ?? 0;
    const extraLb = stone[2] ? (toNumber(stone[2]) ?? 0) : 0;
    return inRange(st * STONE_TO_KG + extraLb * LB_TO_KG, WEIGHT_KG_MIN, WEIGHT_KG_MAX);
  }

  const bare = toNumber(value);
  return inRange(bare, WEIGHT_KG_MIN, WEIGHT_KG_MAX);
}

function parseAge(raw: number | undefined | null): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return inRange(Math.round(raw), AGE_MIN, AGE_MAX);
}

// ── Activity multipliers (workActivityLevel → factor on BMR) ──────────────────────────────────
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  complete_lack_of_activity: 1.2,
  sedentary_occupational_and_light_recreational_effort: 1.35,
  sedentary_occupational_and_moderate_recreational_effort: 1.45,
  sedentary_occupational_and_intense_recreational_effort: 1.6,
  moderate_occupational_and_recreational_effort: 1.6,
  intense_occupational_and_recreational_effort: 1.8,
};
const DEFAULT_ACTIVITY_MULTIPLIER = 1.4;

function bmiCategoryOf(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

function round(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Round to one decimal without binary float artifacts (e.g. 31.2 not 31.200000000000003). */
function round1(value: number): number {
  return Number(value.toFixed(1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function pctLabel(pct: number): string {
  if (pct === 0) return "maintenance (no adjustment)";
  const magnitude = Math.round(Math.abs(pct) * 100);
  return pct < 0 ? `a ${magnitude}% deficit` : `a ${magnitude}% surplus`;
}

type GoalAdjustment = { pct: number; reason: string };

function goalAdjustment(goal: string, bmiCategory: BmiCategory): GoalAdjustment {
  const normalizedGoal = goal.trim().toLowerCase();
  const overweight = bmiCategory === "overweight" || bmiCategory === "obese";

  if (normalizedGoal === "fat_loss") {
    if (bmiCategory === "obese") return { pct: -0.25, reason: "steady fat loss" };
    if (bmiCategory === "overweight") return { pct: -0.2, reason: "steady fat loss" };
    return { pct: -0.15, reason: "steady fat loss while keeping your muscle" };
  }

  // Confirmed product rule: when someone is above a healthy weight but their goal isn't fat loss,
  // still set a gentle deficit (explained kindly) rather than maintenance or a surplus.
  if (overweight) {
    return { pct: -0.1, reason: "a healthier body composition while you train" };
  }

  if (normalizedGoal === "muscle_gain") {
    return { pct: 0.1, reason: "fueling muscle growth" };
  }
  if (normalizedGoal === "strength") {
    return { pct: 0.05, reason: "supporting your strength gains" };
  }
  return { pct: 0, reason: "your goal and recovery" };
}

const HIGHER_PROTEIN_GOALS = new Set(["muscle_gain", "strength", "fat_loss"]);

export function computeEnergyTargets(intake: CoachingIntake): EnergyTargets {
  const assumptions: string[] = [];

  const sex = parseSex(intake.sex);
  const ageYears = parseAge(intake.age);
  const heightCm = parseHeightCm(intake.height);
  const weightKg = parseWeightKg(intake.weight);
  const goal = typeof intake.mainGoal === "string" ? intake.mainGoal : "general_fitness";

  if (sex === "unknown") {
    assumptions.push(
      "Sex wasn't specified, so we used a neutral average for the calorie math — tell us and we'll fine-tune it.",
    );
  }

  const missing: string[] = [];
  if (ageYears === null) missing.push("age");
  if (heightCm === null) missing.push("height");
  if (weightKg === null) missing.push("weight");

  if (ageYears === null || heightCm === null || weightKg === null) {
    return {
      computable: false,
      sex,
      ageYears,
      heightCm,
      weightKg,
      bmi: null,
      bmiCategory: "unknown",
      bmr: null,
      activityMultiplier: null,
      tdee: null,
      goalAdjustmentPct: null,
      targetCalories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      fiber_g: null,
      method: `Couldn't compute exact calorie targets because ${missing.join(", ")} ${missing.length === 1 ? "was" : "were"} missing or unclear; the coach will estimate from what's known and adjust.`,
      assumptions: [
        ...assumptions,
        `Missing or unclear ${missing.join(", ")} — the calorie target is an estimate to refine once we have it.`,
      ],
    };
  }

  // ── BMR (Mifflin-St Jeor, sex-specific) ────────────────────────────────────────────────────
  const sexConstant = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr = round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexConstant, 1);

  // ── Activity multiplier → TDEE ─────────────────────────────────────────────────────────────
  const activityKey = typeof intake.workActivityLevel === "string" ? intake.workActivityLevel : "";
  let activityMultiplier = ACTIVITY_MULTIPLIERS[activityKey];
  if (activityMultiplier === undefined) {
    activityMultiplier = DEFAULT_ACTIVITY_MULTIPLIER;
    assumptions.push(
      "Activity level wasn't clear, so we assumed lightly-to-moderately active — we'll adjust as your week settles.",
    );
  }
  const trainingDays =
    typeof intake.availableDaysPerWeek === "number" ? intake.availableDaysPerWeek : 0;
  const trainingNudge = trainingDays >= 5 ? 0.05 : trainingDays >= 3 ? 0.03 : 0;
  activityMultiplier = clamp(
    Math.round((activityMultiplier + trainingNudge) * 100) / 100,
    1.2,
    1.9,
  );
  const tdee = round(bmr * activityMultiplier, 1);

  // ── BMI + goal weight (caps protein/floor so high fat mass doesn't inflate targets) ─────────
  const heightM = heightCm / 100;
  const bmi = round1(weightKg / (heightM * heightM));
  const bmiCategory = bmiCategoryOf(bmi);
  const goalWeightKg = clamp(HEALTHY_BMI_CEILING * heightM * heightM, WEIGHT_KG_MIN, WEIGHT_KG_MAX);
  const basisWeightKg = Math.min(weightKg, goalWeightKg);

  // ── Goal adjustment → raw target ───────────────────────────────────────────────────────────
  const adjustment = goalAdjustment(goal, bmiCategory);
  let targetCalories = tdee * (1 + adjustment.pct);

  // ── Sanity bounds (the actual guardrails) ──────────────────────────────────────────────────
  const sexFloor = sex === "male" ? 1500 : 1200;
  const perKgFloor = 22 * basisWeightKg;
  const maxDeficitFloor = 0.7 * tdee;
  const effectiveFloor = Math.max(sexFloor, perKgFloor, maxDeficitFloor);
  const ceiling = 1.2 * tdee;

  if (targetCalories < effectiveFloor) {
    assumptions.push(
      `Kept calories at a safe floor (~${round(effectiveFloor, 10)} kcal) rather than cutting deeper — going lower isn't safe or sustainable.`,
    );
    targetCalories = effectiveFloor;
  }
  if (targetCalories > ceiling) {
    assumptions.push(
      `Capped the surplus at ~${round(ceiling, 10)} kcal so weight gain stays lean and controlled.`,
    );
    targetCalories = ceiling;
  }
  // Contradiction guard: a fat-loss goal should never land above maintenance.
  if (adjustment.pct < 0 && targetCalories > tdee) {
    targetCalories = tdee;
  }
  targetCalories = round(targetCalories, 10);

  // ── Macros ─────────────────────────────────────────────────────────────────────────────────
  const proteinPerKg = HIGHER_PROTEIN_GOALS.has(goal.trim().toLowerCase()) ? 2.0 : 1.6;
  const protein_g = round(proteinPerKg * basisWeightKg, 5);

  const fatFloorG = 0.6 * basisWeightKg;
  let fat_g = Math.max(fatFloorG, (0.25 * targetCalories) / 9);
  let carbs_g = (targetCalories - protein_g * 4 - fat_g * 9) / 4;
  if (carbs_g < 50) {
    // Protect a minimum carb intake by trimming fat to its floor before squeezing carbs.
    fat_g = fatFloorG;
    carbs_g = (targetCalories - protein_g * 4 - fat_g * 9) / 4;
  }
  fat_g = round(fat_g, 5);
  carbs_g = round(Math.max(carbs_g, 0), 5);
  const fiber_g = clamp(Math.round((14 * targetCalories) / 1000), 25, 40);

  const method =
    `Mifflin-St Jeor BMR ${Math.round(bmr)} kcal × activity ${activityMultiplier.toFixed(2)} ` +
    `= ~${Math.round(tdee)} kcal/day to maintain, then ${pctLabel(adjustment.pct)} for ` +
    `${adjustment.reason} → ${Math.round(targetCalories)} kcal/day.`;

  return {
    computable: true,
    sex,
    ageYears,
    heightCm: round1(heightCm),
    weightKg: round1(weightKg),
    bmi,
    bmiCategory,
    bmr,
    activityMultiplier,
    tdee,
    goalAdjustmentPct: adjustment.pct,
    targetCalories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    method,
    assumptions,
  };
}

// Re-export a tidy view used when injecting numbers into prompts (training only needs a subset).
export function summarizeEnergyTargets(targets: EnergyTargets): string {
  if (!targets.computable) {
    return "Calorie targets could not be computed from the intake; estimate and state the assumption.";
  }
  return (
    `~${targets.targetCalories} kcal/day, ${targets.protein_g} g protein, ${targets.carbs_g} g carbs, ` +
    `${targets.fat_g} g fat, ${targets.fiber_g} g fiber (${targets.sex}, BMI ${targets.bmi} ${targets.bmiCategory}).`
  );
}
