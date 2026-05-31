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
    const generated = await generateCoachingPlan({
      intakePayload: intakeSubmission.payload,
      mode: input.orchestrationMode,
    });

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
