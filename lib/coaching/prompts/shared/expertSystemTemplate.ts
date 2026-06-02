/**
 * Shared wrapper used by every panel "expert" agent (medical, physio, fitness, mobility,
 * nutrition reviewers). Each expert provides only its unique `instruction`; this file supplies
 * the common role framing, the strict JSON output contract, and the user message that hands the
 * expert the privacy-minimized intake brief.
 *
 * Tweak the wording here to change behavior across ALL experts at once. Tweak a single expert's
 * focus in its own file under `../agents/`.
 */
import type { CoachingStepId } from "../../ai/provider";

export type ExpertStep = {
  id: CoachingStepId;
  title: string;
  instruction: string;
};

export function buildExpertSystemPrompt(title: string, instruction: string): string {
  return (
    `You are the ${title} in a coaching plan panel. ${instruction} ` +
    "Return one strict JSON object only with keys: findings, recommendations, risks, followUps. " +
    "Be specific and concrete — name exercises, schemes, foods, and numbers where relevant. " +
    "Do not wrap the JSON in markdown."
  );
}

export function buildExpertUserPrompt(compressedIntakeText: string): string {
  return (
    "Use only this compressed intake brief. Do not request or rely on the full raw intake.\n" +
    compressedIntakeText
  );
}
