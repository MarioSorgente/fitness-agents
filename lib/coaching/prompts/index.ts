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
 *   3. physioReviewer        ├─ panel reviewers, run in parallel (share shared/expertSystemTemplate)
 *   4. mobilityCoach         ┘
 *   5. panelBrief
 *   6. trainingPlanWriter  ┐ DRAFT — the two premium writers run in parallel (async), each owning
 *   7. nutritionPlanWriter ┘ its domain analysis + writing (phase count from shared/planDuration)
 *   8. trainingPlanChallenge  ┐ CHALLENGE — run in parallel; each writer sees the other's draft,
 *   9. nutritionPlanChallenge ┘ challenges it, and revises for one coherent combined plan
 *
 * Note: the old `fitnessCoach` and `nutritionReviewer` reviewer steps were merged into the two
 * writers — each writer now does its own domain analysis, so there is no separate analyst.
 */

// Agents
export {
  intakeCompressionSystemPrompt,
  buildIntakeCompressionUserPrompt,
} from "./agents/intakeCompression";
export { medicalSafetyScreener } from "./agents/medicalSafetyScreener";
export { physioReviewer } from "./agents/physioReviewer";
export { mobilityCoach } from "./agents/mobilityCoach";
export { panelBriefSystemPrompt } from "./agents/panelBrief";
export {
  buildTrainingPlanWriterSystemPrompt,
  buildTrainingPlanChallengePrompt,
} from "./agents/trainingPlanWriter";
export {
  buildNutritionPlanWriterSystemPrompt,
  buildNutritionPlanChallengePrompt,
} from "./agents/nutritionPlanWriter";

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

// Ordered panel-reviewer list (the orchestrator runs them in this sequence). These are the
// cheap, safety/movement-focused reviewers; the two premium writers consume their reconciled
// brief and do the actual fitness/nutrition design themselves.
import { medicalSafetyScreener } from "./agents/medicalSafetyScreener";
import { physioReviewer } from "./agents/physioReviewer";
import { mobilityCoach } from "./agents/mobilityCoach";
import type { ExpertStep } from "./shared/expertSystemTemplate";

export const EXPERT_STEPS: ReadonlyArray<ExpertStep> = [
  medicalSafetyScreener,
  physioReviewer,
  mobilityCoach,
];
