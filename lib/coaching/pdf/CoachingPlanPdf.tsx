import type { CoachingPlan, PdfGenerationRequest } from "../schemas/coachingPlanSchema";
import {
  AppendixSection,
  CoverSection,
  NutritionRecoverySection,
  PlanSummarySection,
  TrainingSection,
  type PdfSection,
} from "./sections";

export type CoachingPlanPdfProps = {
  plan: CoachingPlan;
  request: PdfGenerationRequest;
};

export type CoachingPlanPdfDocument = {
  title: string;
  author: string;
  subject: string;
  sections: PdfSection[];
};

export function CoachingPlanPdf({ plan, request }: CoachingPlanPdfProps): CoachingPlanPdfDocument {
  const content = plan.plan.content;
  const appendix = request.includeAppendix
    ? AppendixSection({ agentOutputs: plan.agentOutputs })
    : null;

  return {
    title: `Coaching plan ${plan.id}`,
    author: "Fitness Agents",
    subject: "Approved coaching plan",
    sections: [
      CoverSection({ plan, request }),
      PlanSummarySection({ content }),
      TrainingSection({ content }),
      NutritionRecoverySection({ content }),
      ...(appendix ? [appendix] : []),
    ],
  };
}
