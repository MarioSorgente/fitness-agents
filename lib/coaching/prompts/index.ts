/**
 * Coaching prompt registry — the single place to find every agent prompt.
 *
 * Each agent's editable prompt lives in its own file under `agents/`. Reusable fragments live
 * under `shared/`. The orchestrator (`../orchestration/generateCoachingPlan.ts`) only sequences
 * these steps; the wording lives here so it can be tweaked without touching workflow code.
 *
 * Pipeline order:
 *   1. intakeCompression
 *   2. medicalSafetyScreener ┐
 *   3. physioReviewer        │
 *   4. fitnessCoach          ├─ panel experts (share shared/expertSystemTemplate)
 *   5. mobilityCoach         │
 *   6. nutritionReviewer     ┘
 *   7. panelBrief
 *   8. trainingPlanWriter    ┐ premium writers (phase count from shared/planDuration)
 *   9. nutritionPlanWriter   ┘
 */

// Agents
export {
  intakeCompressionSystemPrompt,
  buildIntakeCompressionUserPrompt,
} from "./agents/intakeCompression";
export { medicalSafetyScreener } from "./agents/medicalSafetyScreener";
export { physioReviewer } from "./agents/physioReviewer";
export { fitnessCoach } from "./agents/fitnessCoach";
export { mobilityCoach } from "./agents/mobilityCoach";
export { nutritionReviewer } from "./agents/nutritionReviewer";
export { panelBriefSystemPrompt } from "./agents/panelBrief";
export { buildTrainingPlanWriterSystemPrompt } from "./agents/trainingPlanWriter";
export { buildNutritionPlanWriterSystemPrompt } from "./agents/nutritionPlanWriter";

// Shared fragments / helpers
export {
  type ExpertStep,
  buildExpertSystemPrompt,
  buildExpertUserPrompt,
} from "./shared/expertSystemTemplate";
export {
  PLAN_DURATION_WEEKS,
  DEFAULT_PLAN_DURATION_WEEKS,
  type PlanDurationWeeks,
  type PlanDurationDescriptor,
  describePlanDuration,
} from "./shared/planDuration";

// Ordered panel-expert list (the orchestrator runs them in this sequence).
import { medicalSafetyScreener } from "./agents/medicalSafetyScreener";
import { physioReviewer } from "./agents/physioReviewer";
import { fitnessCoach } from "./agents/fitnessCoach";
import { mobilityCoach } from "./agents/mobilityCoach";
import { nutritionReviewer } from "./agents/nutritionReviewer";
import type { ExpertStep } from "./shared/expertSystemTemplate";

export const EXPERT_STEPS: ReadonlyArray<ExpertStep> = [
  medicalSafetyScreener,
  physioReviewer,
  fitnessCoach,
  mobilityCoach,
  nutritionReviewer,
];
