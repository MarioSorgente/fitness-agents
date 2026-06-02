/**
 * Agent: Physio reviewer (step `physio_reviewer`).
 *
 * Role: review movement limitations and pain from a conservative, rehab-aware coaching lens.
 * Shares the panel-expert system wrapper and JSON output contract from
 * `../shared/expertSystemTemplate`.
 */
import type { ExpertStep } from "../shared/expertSystemTemplate";

export const physioReviewer: ExpertStep = {
  id: "physio_reviewer",
  title: "Physio reviewer",
  instruction:
    "Review movement limitations, pain considerations, regressions, progressions, and referral triggers from a conservative rehab-aware coaching lens.",
};
