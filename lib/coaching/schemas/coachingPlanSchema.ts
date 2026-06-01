import { z } from "zod";

import { expertOutputSchema, panelBriefSchema } from "./expertOutputSchema";
import { coachingIntakeSchema, jsonObjectSchema, jsonValueSchema } from "./intakeSchema";

export const coachingRecordStatusSchema = z.enum([
  "draft",
  "queued",
  "running",
  "ready",
  "failed",
  "archived",
]);

export const reviewStatusSchema = z.enum([
  "not_started",
  "in_review",
  "approved",
  "changes_requested",
]);

export const coachingPlanContentSchema = z
  .object({
    version: z.number().int().positive().default(1),
    orchestrationMode: z.enum(["test", "production"]).optional(),
    source: z.string().trim().max(256).optional(),
    generatedAt: z.string().datetime().optional(),
    finalModerator: z
      .object({
        provider: z.string().trim().min(1).max(128),
        model: z.string().trim().min(1).max(256),
      })
      .catchall(jsonValueSchema)
      .optional(),
    // Editable, human-readable coaching document (intake summary + plan). This is the
    // artifact the admin edits and exports to PDF; `content` keeps the structured JSON.
    markdown: z.string().max(200_000).optional(),
    content: jsonObjectSchema.default({}),
  })
  .catchall(jsonValueSchema);

export const coachingAgentOutputsSchema = z
  .object({
    status: z.string().trim().min(1).max(128).optional(),
    generatedAt: z.string().datetime().optional(),
    compressedIntake: z.union([coachingIntakeSchema, jsonObjectSchema]).optional(),
    expertOutputs: z.array(expertOutputSchema).default([]),
    panelBrief: panelBriefSchema.optional(),
    finalModerator: jsonObjectSchema.optional(),
    routing: jsonObjectSchema.optional(),
    rawIntakeDistribution: z.string().trim().max(1_000).optional(),
  })
  .catchall(jsonValueSchema);

export const coachingPlanSchema = z
  .object({
    id: z.string().trim().min(1).max(256),
    userId: z.string().trim().min(1).max(256),
    intakeSubmissionId: z.string().trim().min(1).max(256),
    status: coachingRecordStatusSchema,
    plan: coachingPlanContentSchema,
    agentOutputs: coachingAgentOutputsSchema.optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    publishedAt: z.date().optional(),
  })
  .catchall(jsonValueSchema);

export const pdfGenerationRequestSchema = z
  .object({
    userId: z.string().trim().min(1).max(256).optional(),
    planId: z.string().trim().min(1).max(256).optional(),
    includeAppendix: z.boolean().default(true),
    // Primary path: render the edited Markdown document directly to PDF.
    markdown: z.string().min(1).max(200_000).optional(),
    documentTitle: z.string().trim().max(256).optional(),
    // Inline plan for stateless rendering — required when the repository is ephemeral
    // (e.g. serverless local-mode) and a lookup by planId would otherwise miss.
    inlinePlan: z
      .object({
        id: z.string().trim().min(1).max(256),
        userId: z.string().trim().min(1).max(256).optional(),
        intakeSubmissionId: z.string().trim().min(1).max(256).optional(),
        plan: coachingPlanContentSchema,
      })
      .optional(),
  })
  .refine((value) => Boolean(value.markdown || value.inlinePlan || value.planId), {
    message: "Either markdown, inlinePlan, or planId must be provided.",
    path: ["markdown"],
  });

export type CoachingPlanContent = z.infer<typeof coachingPlanContentSchema>;
export type CoachingAgentOutputs = z.infer<typeof coachingAgentOutputsSchema>;
export type CoachingPlan = z.infer<typeof coachingPlanSchema>;
export type PdfGenerationRequest = z.infer<typeof pdfGenerationRequestSchema>;
