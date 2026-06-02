/**
 * Agent: Mobility coach (step `mobility_coach`).
 *
 * Role: recommend mobility, warm-up, cooldown, recovery, and movement-prep priorities that
 * support the plan and the client's limitations. Shares the panel-expert system wrapper and JSON
 * output contract from `../shared/expertSystemTemplate`.
 */
import type { ExpertStep } from "../shared/expertSystemTemplate";

export const mobilityCoach: ExpertStep = {
  id: "mobility_coach",
  title: "Mobility coach",
  instruction:
    "Recommend mobility, warm-up, cooldown, recovery, and movement-prep priorities that support the plan and the stated limitations.",
};
