/**
 * Energy-targets regression guard (no test runner is configured, so run this directly):
 *
 *   npx tsx scripts/check-energy-targets.ts
 *
 * Asserts the deterministic calorie/macro engine stays sex- and body-composition-aware and
 * sanity-bounded — in particular that a woman never gets handed ~2700 kcal/day. Exits non-zero on
 * any failed assertion.
 */
import { computeEnergyTargets, type EnergyTargets } from "../lib/coaching/nutrition/energyTargets";

let failures = 0;
function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log("  ok -", label);
  } else {
    failures += 1;
    console.error("  FAIL -", label, detail);
  }
}

function targets(intake: Record<string, unknown>): EnergyTargets {
  return computeEnergyTargets(intake as never);
}

// 1) The reported bug: a 62 kg / 168 cm woman aiming for fat loss must land well under 2000 kcal.
const bug = targets({
  sex: "female",
  age: 35,
  height: "168 cm",
  weight: "62 kg",
  mainGoal: "fat_loss",
  workActivityLevel: "sedentary_occupational_and_moderate_recreational_effort",
  availableDaysPerWeek: 3,
});
check(
  "female fat-loss is sex-aware, not 2700",
  (bug.targetCalories ?? 0) < 2000,
  `got ${bug.targetCalories}`,
);
check(
  "female fat-loss above the safe floor",
  (bug.targetCalories ?? 0) >= 1200,
  `got ${bug.targetCalories}`,
);
check("female fat-loss is a deficit", (bug.goalAdjustmentPct ?? 0) < 0);

// 2) Hard floor: a small sedentary woman is clamped to 1200, never lower.
const floor = targets({
  sex: "female",
  age: 25,
  height: "150 cm",
  weight: "45 kg",
  mainGoal: "fat_loss",
  workActivityLevel: "complete_lack_of_activity",
  availableDaysPerWeek: 1,
});
check("female calorie floor = 1200", floor.targetCalories === 1200, `got ${floor.targetCalories}`);

// 3) Overweight/obese + non-fat-loss goal → a gentle default deficit (confirmed product rule).
const obese = targets({
  sex: "female",
  age: 40,
  height: "165 cm",
  weight: "85 kg",
  mainGoal: "general_fitness",
  workActivityLevel: "sedentary_occupational_and_light_recreational_effort",
  availableDaysPerWeek: 3,
});
check("obese is classified", obese.bmiCategory === "obese", `got ${obese.bmiCategory}`);
check(
  "overweight non-fat-loss gets a gentle deficit",
  obese.goalAdjustmentPct === -0.1,
  `got ${obese.goalAdjustmentPct}`,
);

// 4) Surplus is capped at 1.2× TDEE.
const surplus = targets({
  sex: "male",
  age: 22,
  height: "180 cm",
  weight: "70 kg",
  mainGoal: "muscle_gain",
  workActivityLevel: "intense_occupational_and_recreational_effort",
  availableDaysPerWeek: 6,
});
check(
  "surplus capped at 1.2x TDEE",
  (surplus.targetCalories ?? 0) <= 1.2 * (surplus.tdee ?? 0) + 1,
);

// 5) Imperial parsing works.
const imperial = targets({
  sex: "male",
  age: 30,
  height: "5'11\"",
  weight: "180 lb",
  mainGoal: "strength",
  availableDaysPerWeek: 4,
});
check(
  "imperial height parses (~180 cm)",
  Math.abs((imperial.heightCm ?? 0) - 180.3) < 1,
  `got ${imperial.heightCm}`,
);
check(
  "imperial weight parses (~81.6 kg)",
  Math.abs((imperial.weightKg ?? 0) - 81.6) < 0.5,
  `got ${imperial.weightKg}`,
);

// 6) Missing weight degrades gracefully.
const missing = targets({
  sex: "female",
  age: 30,
  height: "170 cm",
  weight: "",
  mainGoal: "fat_loss",
});
check("missing weight → not computable", missing.computable === false);
check("not-computable still names the sex", missing.sex === "female");

if (failures > 0) {
  console.error(`\nENERGY TARGETS CHECK FAILED (${failures})`);
  process.exit(1);
}
console.log("\nENERGY TARGETS CHECK PASSED");
