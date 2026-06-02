/**
 * Agent: Fitness coach (step `fitness_coach`).
 *
 * Role: produce the concrete training direction (split, exercises, set/rep/intensity schemes,
 * progression model) that the training plan writer later expands into a full program. Shares the
 * panel-expert system wrapper and JSON output contract from `../shared/expertSystemTemplate`.
 */
import type { ExpertStep } from "../shared/expertSystemTemplate";

export const fitnessCoach: ExpertStep = {
  id: "fitness_coach",
  title: "Fitness coach",
  instruction:
    "Design a concrete program direction: pick a specific training split and weekly frequency that fit the available days, equipment, and level; name the priority compound and accessory exercises the plan should include, and the exercises to avoid given any injuries; specify set, rep, and intensity (RPE/%1RM) schemes for the goal; and define a phase-by-phase progression model with deloads and measurable milestones.",
};
