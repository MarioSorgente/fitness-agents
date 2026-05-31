import { NextResponse } from "next/server";
import { z } from "zod";

import {
  documentIdSchema,
  handleRouteError,
  parseJsonBody,
  requireOwnedResource,
  serializeCoachingPlan,
  serializeIntakeSubmission,
  serializeReviewState,
  userIdSchema,
} from "@/lib/coaching/api/routeUtils";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import { buildCoachingTextFallback } from "@/lib/coaching/orchestration/buildTextFallback";
import { generateCoachingPlan } from "@/lib/coaching/orchestration/generateCoachingPlan";

export const runtime = "nodejs";

const generatePlanSchema = z.object({
  userId: userIdSchema,
  intakeSubmissionId: documentIdSchema,
  orchestrationMode: z.enum(["test", "production"]).default("test"),
});

export async function POST(request: Request) {
  try {
    const input = generatePlanSchema.parse(await parseJsonBody(request));
    const repository = createCoachingRepository();
    const intakeSubmission = requireOwnedResource(
      await repository.getIntakeSubmission(input.intakeSubmissionId),
      input.userId,
      "Intake submission",
    );
    const generatedAt = new Date();

    let generated;
    try {
      generated = await generateCoachingPlan({
        intakePayload: intakeSubmission.payload,
        mode: input.orchestrationMode,
      });
    } catch (agentError) {
      const reason =
        agentError instanceof Error ? agentError.message : "AI provider error";
      console.warn("[coaching plan] agent pipeline failed; using text fallback:", reason);

      const planText = buildCoachingTextFallback(intakeSubmission.payload, reason);
      const fallbackPlan = await repository.createCoachingPlan({
        userId: input.userId,
        intakeSubmissionId: intakeSubmission.id,
        status: "ready",
        plan: {
          version: 1,
          orchestrationMode: input.orchestrationMode,
          source: "api/coaching/generate-plan",
          generatedAt: generatedAt.toISOString(),
          content: {
            mode: "text_fallback",
            reason,
            planText,
          },
        },
        agentOutputs: {
          status: "text_fallback",
          generatedAt: generatedAt.toISOString(),
          expertOutputs: [],
        },
      });

      return NextResponse.json(
        {
          data: {
            mode: "text_fallback" as const,
            reason,
            planText,
            intakeSubmission: serializeIntakeSubmission(intakeSubmission),
            plan: serializeCoachingPlan(fallbackPlan),
          },
        },
        { status: 201 },
      );
    }

    const plan = await repository.createCoachingPlan({
      userId: input.userId,
      intakeSubmissionId: intakeSubmission.id,
      status: "ready",
      plan: {
        ...generated.plan,
        generatedAt: generatedAt.toISOString(),
      },
      agentOutputs: {
        ...generated.agentOutputs,
        generatedAt: generatedAt.toISOString(),
      },
    });

    const reviewState = await repository.upsertReviewState({
      userId: input.userId,
      planId: plan.id,
      status: "in_review",
    });

    return NextResponse.json(
      {
        data: {
          mode: "ready" as const,
          intakeSubmission: serializeIntakeSubmission(intakeSubmission),
          plan: serializeCoachingPlan(plan),
          reviewState: serializeReviewState(reviewState),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
