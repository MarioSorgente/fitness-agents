import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ApiRouteError,
  documentIdSchema,
  handleRouteError,
  parseJsonBody,
  requireOwnedResource,
  serializeCoachingExport,
  serializeCoachingPlan,
  serializeReviewState,
  userIdSchema,
} from "@/lib/coaching/api/routeUtils";
import { createFirebaseCoachingRepository } from "@/lib/coaching/db/firebaseCoachingRepository";

export const runtime = "nodejs";

const generatePdfSchema = z.object({
  userId: userIdSchema,
  planId: documentIdSchema,
});

export async function POST(request: Request) {
  try {
    const input = generatePdfSchema.parse(await parseJsonBody(request));
    const repository = createFirebaseCoachingRepository();
    const plan = requireOwnedResource(
      await repository.getCoachingPlan(input.planId),
      input.userId,
      "Coaching plan",
    );
    const reviewState = await repository.getReviewState(plan.id);

    if (reviewState?.status !== "approved") {
      throw new ApiRouteError(
        "PLAN_NOT_APPROVED",
        "PDF generation requires an approved coaching plan.",
        409,
      );
    }

    const queuedAt = new Date();
    const coachingExport = await repository.createCoachingExport({
      userId: input.userId,
      planId: plan.id,
      type: "pdf",
      status: "queued",
      storagePath: `coaching/plans/${plan.id}/exports/${queuedAt.getTime()}.pdf`,
    });

    return NextResponse.json(
      {
        data: {
          plan: serializeCoachingPlan(plan),
          reviewState: serializeReviewState(reviewState),
          export: serializeCoachingExport(coachingExport),
        },
      },
      { status: 202 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
