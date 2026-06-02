/**
 * Agent: Medical safety screener (step `medical_safety_screener`).
 *
 * Role: flag medical risk and coaching boundaries from the compressed intake. It does not
 * diagnose. Shares the panel-expert system wrapper and JSON output contract
 * (findings / recommendations / risks / followUps) from `../shared/expertSystemTemplate`.
 */
import type { ExpertStep } from "../shared/expertSystemTemplate";

export const medicalSafetyScreener: ExpertStep = {
  id: "medical_safety_screener",
  title: "Medical safety screener",
  instruction:
    "Identify medical red flags, contraindications, information that requires clinician clearance, and safe coaching boundaries. Do not diagnose.",
};
