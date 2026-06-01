import { NextResponse } from "next/server";

import {
  ApiRouteError,
  handleRouteError,
  parseJsonBody,
  requireOwnedResource,
} from "@/lib/coaching/api/routeUtils";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import { coachingPlanPdfFilename, renderCoachingPlanPdf } from "@/lib/coaching/pdf/renderPdf";
import { pdfGenerationRequestSchema } from "@/lib/coaching/schemas/coachingPlanSchema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = pdfGenerationRequestSchema.parse(await parseJsonBody(request));
    const repository = createCoachingRepository();
    const plan = requireOwnedResource(
      await repository.getCoachingPlan(input.planId),
      input.userId,
      "Coaching plan",
    );
    if ((plan.plan.content as { mode?: unknown } | undefined)?.mode === "text_fallback") {
      throw new ApiRouteError(
        "PLAN_NOT_APPROVED",
        "This plan was produced in text-fallback mode (AI providers were unavailable) and is not eligible for PDF export. Re-run plan generation once providers are configured.",
        409,
      );
    }

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
