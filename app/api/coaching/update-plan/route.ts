import { NextResponse } from "next/server";
import { z } from "zod";

import {
  documentIdSchema,
  handleRouteError,
  parseJsonBody,
  requireOwnedResource,
  serializeCoachingPlan,
  serializeReviewState,
  userIdSchema,
} from "@/lib/coaching/api/routeUtils";
import {
  coachingAgentOutputsSchema,
  coachingPlanContentSchema,
  coachingRecordStatusSchema,
  reviewStatusSchema,
} from "@/lib/coaching/schemas/coachingPlanSchema";
import { createFirebaseCoachingRepository } from "@/lib/coaching/db/firebaseCoachingRepository";

export const runtime = "nodejs";

const updatePlanSchema = z
  .object({
    userId: userIdSchema,
    planId: documentIdSchema,
    plan: coachingPlanContentSchema.optional(),
    agentOutputs: coachingAgentOutputsSchema.optional(),
    status: coachingRecordStatusSchema.optional(),
    review: z
      .object({
        status: reviewStatusSchema,
        notes: z.string().trim().max(10_000).optional(),
        reviewerId: z.string().trim().min(1).max(256).optional(),
      })
      .optional(),
  })
  .refine((input) => input.plan || input.agentOutputs || input.status || input.review, {
    message: "At least one plan, agentOutputs, status, or review update is required.",
  });

export async function POST(request: Request) {
  try {
    const input = updatePlanSchema.parse(await parseJsonBody(request));
    const repository = createFirebaseCoachingRepository();
    const existingPlan = requireOwnedResource(
      await repository.getCoachingPlan(input.planId),
      input.userId,
      "Coaching plan",
    );

    const updatedPlan = await repository.updateCoachingPlan(existingPlan.id, {
      ...(input.plan ? { plan: input.plan } : {}),
      ...(input.agentOutputs ? { agentOutputs: input.agentOutputs } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.review?.status === "approved" ? { publishedAt: new Date() } : {}),
    });

    const reviewState = input.review
      ? await repository.upsertReviewState({
          userId: input.userId,
          planId: updatedPlan.id,
          status: input.review.status,
          notes: input.review.notes,
          reviewerId: input.review.reviewerId,
        })
      : await repository.getReviewState(updatedPlan.id);

    return NextResponse.json({
      data: {
        plan: serializeCoachingPlan(updatedPlan),
        reviewState: reviewState ? serializeReviewState(reviewState) : null,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export const PATCH = POST;
