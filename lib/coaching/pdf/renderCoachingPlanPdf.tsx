import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import type { CoachingPlan, PdfGenerationRequest } from "../schemas/coachingPlanSchema";

type CoachingPlanPdfDocumentProps = {
  plan: CoachingPlan;
  request: PdfGenerationRequest;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#172033",
  },
  section: {
    marginBottom: 18,
  },
  eyebrow: {
    color: "#637083",
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 10,
  },
  subheading: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
  },
  text: {
    lineHeight: 1.45,
    marginBottom: 5,
  },
  muted: {
    color: "#637083",
    lineHeight: 1.4,
  },
});

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function CoachingPlanPdfDocument({ plan, request }: CoachingPlanPdfDocumentProps) {
  return (
    <Document title={`Coaching plan ${plan.id}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Coaching plan</Text>
          <Text style={styles.heading}>Plan {plan.id}</Text>
          <Text style={styles.muted}>User: {request.userId}</Text>
          <Text style={styles.muted}>Status: {plan.status}</Text>
          {plan.publishedAt ? (
            <Text style={styles.muted}>Published: {plan.publishedAt.toISOString()}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.subheading}>Plan content</Text>
          <Text style={styles.text}>{formatJson(plan.plan.content)}</Text>
        </View>

        {request.includeAppendix && plan.agentOutputs ? (
          <View style={styles.section}>
            <Text style={styles.subheading}>Review appendix</Text>
            <Text style={styles.text}>{formatJson(plan.agentOutputs.panelBrief ?? {})}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderCoachingPlanPdfBuffer(
  plan: CoachingPlan,
  request: PdfGenerationRequest,
): Promise<Buffer> {
  return renderToBuffer(<CoachingPlanPdfDocument plan={plan} request={request} />);
}
