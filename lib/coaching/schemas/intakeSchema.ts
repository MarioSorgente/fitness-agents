import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema);

export const compactClientProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(256).optional(),
    email: z.string().trim().email().max(320).optional(),
    age: z.number().int().min(13).max(120).optional(),
    trainingExperience: z.string().trim().max(500).optional(),
    goals: z.array(z.string().trim().min(1).max(500)).default([]),
    availability: z.string().trim().max(1_000).optional(),
    equipment: z.array(z.string().trim().min(1).max(500)).default([]),
    constraints: z.array(z.string().trim().min(1).max(1_000)).default([]),
    safetySignals: z.array(z.string().trim().min(1).max(1_000)).default([]),
    nutritionSignals: z.array(z.string().trim().min(1).max(1_000)).default([]),
    missingInformation: z.array(z.string().trim().min(1).max(1_000)).default([]),
    coachSummary: z.string().trim().max(5_000).optional(),
  })
  .catchall(jsonValueSchema);

export const coachingIntakeSchema = z
  .object({
    name: z.string().trim().min(1).max(256).optional(),
    email: z.string().trim().email().max(320).optional(),
    experience: z.string().trim().max(500).optional(),
    goals: z
      .union([z.string().trim().min(1).max(500), z.array(z.string().trim().min(1).max(500))])
      .optional(),
    successCriteria: z.string().trim().max(10_000).optional(),
    daysPerWeek: z.coerce.number().int().min(1).max(7).optional(),
    equipment: z.string().trim().max(5_000).optional(),
    limitations: z.string().trim().max(10_000).optional(),
    orchestrationMode: z.enum(["test", "production"]).optional(),
    clientProfile: compactClientProfileSchema.optional(),
  })
  .catchall(jsonValueSchema)
  .refine((input) => Object.keys(input).length > 0, {
    message: "Intake payload must include at least one field.",
  });

export type CompactClientProfile = z.infer<typeof compactClientProfileSchema>;
export type CoachingIntake = z.infer<typeof coachingIntakeSchema>;
