/**
 * Agent: Intake compression (step `intake_compression`).
 *
 * Role: the ONLY step that sees the raw intake. It distills it into a privacy-minimized JSON
 * brief that every downstream expert and writer works from.
 * Output contract: a single JSON object with the keys listed in the user prompt.
 */
import type { CoachingIntake } from "../../schemas/intakeSchema";

export const intakeCompressionSystemPrompt =
  "You compress coaching intakes into a privacy-minimized structured brief. Preserve " +
  "safety-relevant facts, goals, constraints, equipment, schedule, and missing information. " +
  "Do not invent details. Return a single valid JSON object only with no markdown or commentary.";

export function buildIntakeCompressionUserPrompt(intakePayload: CoachingIntake): string {
  return (
    "Compress this raw intake into JSON with keys: clientProfile, goals, schedule, equipment, " +
    "constraints, safetySignals, nutritionSignals, missingInformation, coachSummary. Raw intake:\n" +
    JSON.stringify(intakePayload)
  );
}
