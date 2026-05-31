import React from "react";
import { Text, View } from "@react-pdf/renderer";

import { pdfStyles } from "../pdfTheme";
import type { CoachingPlan, PdfGenerationRequest } from "../../schemas/coachingPlanSchema";

export function CoverSection({
  plan,
  request,
}: {
  plan: CoachingPlan;
  request: PdfGenerationRequest;
}) {
  const publishedLabel = plan.publishedAt
    ? plan.publishedAt.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })
    : "Approved plan";

  return (
    <View>
      <Text style={pdfStyles.eyebrow}>Approved coaching plan</Text>
      <Text style={pdfStyles.title}>Personal Coaching Plan</Text>
      <Text style={pdfStyles.muted}>Prepared for user {request.userId}</Text>
      <View style={pdfStyles.divider} />
      <View style={pdfStyles.panel}>
        <Text style={pdfStyles.smallCaps}>Plan ID</Text>
        <Text style={pdfStyles.body}>{plan.id}</Text>
        <Text style={pdfStyles.smallCaps}>Status</Text>
        <Text style={pdfStyles.body}>{plan.status}</Text>
        <Text style={pdfStyles.smallCaps}>Published</Text>
        <Text>{publishedLabel}</Text>
      </View>
      <Text style={pdfStyles.muted}>
        This PDF is generated on demand after coach approval. It is returned directly as a download
        and is not uploaded to long-term storage in v1.
      </Text>
    </View>
  );
}
