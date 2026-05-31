import type { CoachingPlan, PdfGenerationRequest } from "../../schemas/coachingPlanSchema";
import { compactBlocks, createSection, keyValueBlock, textBlock } from "./Section";

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

  return createSection(
    "Personal Coaching Plan",
    compactBlocks([
      textBlock(`Prepared for user ${request.userId}`, "muted"),
      keyValueBlock([
        ["Plan ID", plan.id],
        ["Status", plan.status],
        ["Published", publishedLabel],
      ]),
      textBlock(
        "This PDF is generated on demand after coach approval. It is returned directly as a download and is not uploaded to long-term storage in v1.",
        "muted",
      ),
    ]),
    "Approved coaching plan",
  );
}
