import { NextResponse } from "next/server";

import {
  ApiRouteError,
  handleRouteError,
  parseJsonBody,
} from "@/lib/coaching/api/routeUtils";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import { markdownPdfFilename, renderMarkdownPdf } from "@/lib/coaching/pdf/renderMarkdownPdf";
import { coachingPlanPdfFilename, renderCoachingPlanPdf } from "@/lib/coaching/pdf/renderPdf";
import {
  type CoachingPlan,
  pdfGenerationRequestSchema,
} from "@/lib/coaching/schemas/coachingPlanSchema";

export const runtime = "nodejs";
export const maxDuration = 60;

function pdfResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
      "Content-Type": "application/pdf",
    },
    status: 200,
  });
}

export async function POST(request: Request) {
  try {
    const input = pdfGenerationRequestSchema.parse(await parseJsonBody(request));

    // Primary path: render the (edited) Markdown document directly.
    if (input.markdown) {
      const buffer = renderMarkdownPdf(input.markdown, {
        title: input.documentTitle,
        subject: "Coaching document",
      });
      return pdfResponse(buffer, markdownPdfFilename(input.planId));
    }

    let plan: CoachingPlan;

    if (input.inlinePlan) {
      const now = new Date();
      plan = {
        id: input.inlinePlan.id,
        userId: input.inlinePlan.userId ?? input.userId ?? "anonymous-intake",
        intakeSubmissionId: input.inlinePlan.intakeSubmissionId ?? "inline",
        status: "ready",
        plan: input.inlinePlan.plan,
        createdAt: now,
        updatedAt: now,
      } as CoachingPlan;
    } else {
      if (!input.planId) {
        throw new ApiRouteError("BAD_REQUEST", "planId is required when inlinePlan is omitted.", 400);
      }
      const repository = createCoachingRepository();
      const found = await repository.getCoachingPlan(input.planId);
      if (!found) {
        throw new ApiRouteError(
          "NOT_FOUND",
          "Coaching plan was not found. If the deployment uses ephemeral local storage, retry with inlinePlan in the request body.",
          404,
        );
      }
      plan = found;
    }

    if ((plan.plan.content as { mode?: unknown } | undefined)?.mode === "text_fallback") {
      throw new ApiRouteError(
        "PLAN_NOT_APPROVED",
        "This plan was produced in text-fallback mode (AI providers were unavailable) and is not eligible for PDF export. Re-run plan generation once providers are configured.",
        409,
      );
    }

    const pdfBuffer = await renderCoachingPlanPdf(plan, {
      userId: plan.userId,
      planId: plan.id,
      includeAppendix: input.includeAppendix,
    });
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
