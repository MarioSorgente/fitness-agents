import { z } from "zod";

import { compactClientProfileSchema, jsonValueSchema } from "./intakeSchema";

export const expertOutputSchema = z
  .object({
    step: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(256),
    provider: z.string().trim().min(1).max(128),
    model: z.string().trim().min(1).max(256),
    findings: z.array(z.string().trim().min(1).max(2_000)).default([]),
    recommendations: z.array(z.string().trim().min(1).max(2_000)).default([]),
    risks: z.array(z.string().trim().min(1).max(2_000)).default([]),
    followUps: z.array(z.string().trim().min(1).max(2_000)).default([]),
    content: z.string().trim().max(20_000).optional(),
  })
  .catchall(jsonValueSchema);

export const panelBriefSchema = z
  .object({
    clientProfile: compactClientProfileSchema.optional(),
    agreements: z.array(z.string().trim().min(1).max(2_000)).default([]),
    conflicts: z.array(z.string().trim().min(1).max(2_000)).default([]),
    safetyGates: z.array(z.string().trim().min(1).max(2_000)).default([]),
    planDirection: z.array(z.string().trim().min(1).max(2_000)).default([]),
    expertOutputs: z.array(expertOutputSchema).default([]),
    content: z.string().trim().max(30_000).optional(),
  })
  .catchall(jsonValueSchema);

export type ExpertOutput = z.infer<typeof expertOutputSchema>;
export type PanelBrief = z.infer<typeof panelBriefSchema>;
