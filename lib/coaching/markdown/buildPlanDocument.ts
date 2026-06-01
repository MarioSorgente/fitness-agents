import type { CoachingIntake } from "../schemas/intakeSchema";
import { buildIntakeSummaryMarkdown } from "./buildIntakeSummary";

const SAFETY_STATUS_LABEL: Record<string, string> = {
  clear: "Clear",
  caution: "Caution",
  medical_clearance_recommended: "Medical clearance recommended",
};

function clientName(intake: CoachingIntake): string {
  const input = intake as unknown as Record<string, unknown>;
  const name = input.fullName ?? input.name;
  return typeof name === "string" && name.trim() ? name.trim() : "Client";
}

function formatDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

const DISCLAIMER =
  "> **Disclaimer:** This document is educational wellness coaching support, not medical " +
  "advice, diagnosis, or physical therapy. Stop any movement that causes sharp pain or unusual " +
  "symptoms and seek qualified medical help. If a safety concern was flagged, consider clinician " +
  "clearance before progressing intensity.";

/**
 * Combine the deterministic intake summary (Part 1) with the AI-authored coaching
 * plan Markdown (Part 2) into a single, editable, well-structured document.
 */
export function assemblePlanDocument(
  intake: CoachingIntake,
  planMarkdown: string,
  options: { generatedAt?: Date } = {},
): string {
  const name = clientName(intake);
  const generatedAt = options.generatedAt ?? new Date();
  const input = intake as unknown as Record<string, unknown>;
  const safetyStatus = typeof input.safetyStatus === "string" ? input.safetyStatus : "clear";
  const safetyLabel = SAFETY_STATUS_LABEL[safetyStatus] ?? safetyStatus;

  const intakeSummary = buildIntakeSummaryMarkdown(intake);
  const plan = planMarkdown.trim();

  return [
    `# Coaching document — ${name}`,
    "",
    `_Prepared ${formatDate(generatedAt)} · Safety status: ${safetyLabel}_`,
    "",
    "## Part 1 · Client intake summary",
    "",
    intakeSummary,
    "",
    "## Part 2 · Coaching plan",
    "",
    plan.length > 0
      ? plan
      : "_The coaching plan was not generated automatically. Add the plan content here._",
    "",
    "---",
    "",
    DISCLAIMER,
    "",
  ].join("\n");
}
