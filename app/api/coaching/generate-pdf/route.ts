import { NextResponse } from "next/server";
import {
  ApiRouteError,
  handleRouteError,
  parseJsonBody,
  requireOwnedResource,
  serializeCoachingExport,
  serializeCoachingPlan,
  serializeReviewState,
} from "@/lib/coaching/api/routeUtils";
import { pdfGenerationRequestSchema } from "@/lib/coaching/schemas/coachingPlanSchema";
import { createFirebaseCoachingRepository } from "@/lib/coaching/db/firebaseCoachingRepository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = pdfGenerationRequestSchema.parse(await parseJsonBody(request));
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
