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
import { createFirebaseCoachingRepository } from "@/lib/coaching/db/firebaseCoachingRepository";

export const runtime = "nodejs";

const generatePlanSchema = z.object({
  userId: userIdSchema,
  intakeSubmissionId: documentIdSchema,
});

export async function POST(request: Request) {
  try {
    const input = generatePlanSchema.parse(await parseJsonBody(request));
    const repository = createFirebaseCoachingRepository();
    const intakeSubmission = requireOwnedResource(
      await repository.getIntakeSubmission(input.intakeSubmissionId),
      input.userId,
      "Intake submission",
    );
    const generatedAt = new Date();

    const plan = await repository.createCoachingPlan({
      userId: input.userId,
      intakeSubmissionId: intakeSubmission.id,
      status: "ready",
      plan: {
        version: 1,
        generatedAt: generatedAt.toISOString(),
        source: "api/coaching/generate-plan",
        summary: "Draft coaching plan generated from the submitted intake and pending approval.",
      },
      agentOutputs: {
        generatedAt: generatedAt.toISOString(),
        status: "placeholder_generated",
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
