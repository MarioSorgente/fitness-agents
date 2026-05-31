import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import type { CoachingPlan, PdfGenerationRequest } from "../schemas/coachingPlanSchema";
import { CoachingPlanPdf } from "./CoachingPlanPdf";

export async function renderCoachingPlanPdf(
  plan: CoachingPlan,
  request: PdfGenerationRequest,
): Promise<Buffer> {
  return renderToBuffer(<CoachingPlanPdf plan={plan} request={request} />);
}

export function coachingPlanPdfFilename(plan: CoachingPlan): string {
  const safePlanId = plan.id.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");

  return `coaching-plan-${safePlanId || "approved"}.pdf`;
}
