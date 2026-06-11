import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiRouteError, handleRouteError, parseJsonBody } from "@/lib/coaching/api/routeUtils";
import { requireAdminApi } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import { buildCoachQuestionsSection } from "@/lib/coaching/markdown/buildCoachQuestions";
import { buildIntakeSummaryMarkdown } from "@/lib/coaching/markdown/buildIntakeSummary";
import type { CoachingIntake, CompactClientProfile } from "@/lib/coaching/schemas/intakeSchema";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  submissionId: z.string().trim().min(1),
  // When true, append a cheap-model-generated "Questions for the coach to ask"
  // section. When false/omitted the export is a fast, deterministic, AI-free dump.
  withQuestions: z.boolean().optional().default(false),
});

function clientName(payload: Record<string, unknown>): string {
  const full = payload.fullName;
  if (typeof full === "string" && full.trim()) return full.trim();
  const profile = payload.clientProfile as CompactClientProfile | undefined;
  if (profile?.name && profile.name.trim()) return profile.name.trim();
  return "Client";
}

export async function POST(request: Request) {
  try {
    await requireAdminApi();
    const input = requestSchema.parse(await parseJsonBody(request));

    const repository = createCoachingRepository();
    const submission = await repository.getIntakeSubmission(input.submissionId);
    if (!submission) {
      throw new ApiRouteError("NOT_FOUND", "Intake submission was not found.", 404);
    }

    const payload = submission.payload as unknown as Record<string, unknown>;
    const intake = payload as unknown as CoachingIntake;

    const exportedOn = new Date().toISOString().slice(0, 10);
    const summary = buildIntakeSummaryMarkdown(intake);

    const parts = [
      `# Client intake — ${clientName(payload)}`,
      `_Submission ${submission.id} · exported ${exportedOn}_`,
      summary,
    ];

    if (input.withQuestions) {
      parts.push("---", await buildCoachQuestionsSection(summary));
    }

    const document = `${parts.join("\n\n")}\n`;
    const filename = `intake-${submission.id}${input.withQuestions ? "-with-questions" : ""}.md`;

    return new NextResponse(document, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "text/markdown; charset=utf-8",
      },
      status: 200,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
