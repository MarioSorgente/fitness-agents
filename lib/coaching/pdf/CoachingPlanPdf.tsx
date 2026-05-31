import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";

import type { CoachingPlan, PdfGenerationRequest } from "../schemas/coachingPlanSchema";
import { pdfStyles } from "./pdfTheme";
import {
  AppendixSection,
  CoverSection,
  NutritionRecoverySection,
  PlanSummarySection,
  TrainingSection,
} from "./sections";

export type CoachingPlanPdfProps = {
  plan: CoachingPlan;
  request: PdfGenerationRequest;
};

function PageFooter({ planId }: { planId: string }) {
  return (
    <View fixed style={pdfStyles.footer}>
      <Text>Coaching plan {planId}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export function CoachingPlanPdf({ plan, request }: CoachingPlanPdfProps) {
  const content = plan.plan.content;

  return (
    <Document
      author="Fitness Agents"
      subject="Approved coaching plan"
      title={`Coaching plan ${plan.id}`}
    >
      <Page size="LETTER" style={pdfStyles.coverPage}>
        <CoverSection plan={plan} request={request} />
        <PageFooter planId={plan.id} />
      </Page>
      <Page size="LETTER" style={pdfStyles.page}>
        <PlanSummarySection content={content} />
        <TrainingSection content={content} />
        <NutritionRecoverySection content={content} />
        {request.includeAppendix ? <AppendixSection agentOutputs={plan.agentOutputs} /> : null}
        <PageFooter planId={plan.id} />
      </Page>
    </Document>
  );
}
