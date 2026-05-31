import { NextResponse } from "next/server";

import {
  ApiRouteError,
  handleRouteError,
  parseJsonBody,
  requireOwnedResource,
} from "@/lib/coaching/api/routeUtils";
import { createFirebaseCoachingRepository } from "@/lib/coaching/db/firebaseCoachingRepository";
import { coachingPlanPdfFilename, renderCoachingPlanPdf } from "@/lib/coaching/pdf/renderPdf";
import { pdfGenerationRequestSchema } from "@/lib/coaching/schemas/coachingPlanSchema";

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

    const pdfBuffer = await renderCoachingPlanPdf(plan, input);
    const filename = coachingPlanPdfFilename(plan);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.byteLength),
        "Content-Type": "application/pdf",
      },
      status: 200,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
