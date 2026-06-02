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
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";

export const runtime = "nodejs";

const updatePlanSchema = z
  .object({
    userId: userIdSchema,
    planId: documentIdSchema,
    plan: coachingPlanContentSchema.optional(),
    // Convenience: update only the editable Markdown document without resending the
    // whole plan content. Merged into the existing plan content on the server.
    markdown: z.string().max(200_000).optional(),
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
  .refine(
    (input) =>
      input.plan ||
      input.markdown !== undefined ||
      input.agentOutputs ||
      input.status ||
      input.review,
    {
      message: "At least one plan, markdown, agentOutputs, status, or review update is required.",
    },
  );

export async function POST(request: Request) {
  try {
    const input = updatePlanSchema.parse(await parseJsonBody(request));
    const repository = createCoachingRepository();
    const existingPlan = requireOwnedResource(
      await repository.getCoachingPlan(input.planId),
      input.userId,
      "Coaching plan",
    );

    // A full `plan` payload wins; otherwise a lone `markdown` edit is merged into the
    // existing plan content so the structured data is preserved.
    const nextPlan = input.plan
      ? input.plan
      : input.markdown !== undefined
        ? { ...existingPlan.plan, markdown: input.markdown }
        : undefined;

    const updatedPlan = await repository.updateCoachingPlan(existingPlan.id, {
      ...(nextPlan ? { plan: nextPlan } : {}),
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
