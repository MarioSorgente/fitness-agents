import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  handleRouteError,
  parseJsonBody,
  serializeIntakeSubmission,
  userIdSchema,
} from "@/lib/coaching/api/routeUtils";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import { coachingIntakeSchema } from "@/lib/coaching/schemas/intakeSchema";

export const runtime = "nodejs";

const ROUTE_NAME = "POST /api/coaching/submit-intake";

const submitIntakeSchema = z.object({
  id: z.string().trim().min(1).max(256).optional(),
  userId: userIdSchema,
  payload: coachingIntakeSchema,
});

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex").slice(0, 12);
}

function extractString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function joinStrings(value: unknown): string | undefined {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .join(", ") || undefined
    : extractString(value);
}

function yesExplanation(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { answer?: unknown; explanation?: unknown };
  if (record.answer !== "yes") return undefined;
  return extractString(record.explanation) ?? "Yes";
}

function summarizeMedications(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return undefined;
      const med = entry as Record<string, unknown>;
      return [med.medicationName, med.dosage, med.frequency, med.conditionOrReason]
        .map(extractString)
        .filter(Boolean)
        .join(" · ");
    })
    .filter((entry): entry is string => Boolean(entry));
  return entries.join("; ") || undefined;
}

function withContext(error: unknown, message: string): Error {
  const wrapped = new Error(
    `${message}: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  wrapped.name = error instanceof Error ? error.name : "Error";
  wrapped.cause = error;
  return wrapped;
}

export async function POST(request: Request) {
  let safeMetadata: Record<string, string | number | boolean | undefined> = {
    route: ROUTE_NAME,
    timestamp: new Date().toISOString(),
  };

  try {
    const input = submitIntakeSchema.parse(await parseJsonBody(request));
    safeMetadata = {
      ...safeMetadata,
      userIdHash: hashIdentifier(input.userId),
      orchestrationMode: input.payload.orchestrationMode ?? "test",
      safetyStatus: input.payload.safetyStatus,
    };

    let repository;
    try {
      repository = createCoachingRepository();
    } catch (error) {
      throw withContext(error, "Repository selection failed");
    }

    const submittedAt = new Date();
    let submission;
    try {
      submission = await repository.createIntakeSubmission({
        id: input.id,
        userId: input.userId,
        payload: input.payload,
        status: "queued",
        submittedAt,
      });
    } catch (error) {
      throw withContext(error, "Intake repository write failed");
    }

    try {
      await repository.createClientProfile({
        userId: input.userId,
        intakeSubmissionId: submission.id,
        fullName: input.payload.fullName,
        email: input.payload.email,
        phone: extractString(input.payload.phoneNumber),
        status: "lead",
        priority:
          input.payload.safetyStatus === "medical_clearance_recommended" ? "high" : "normal",
        currentWeight: extractString(input.payload.weight),
        height: extractString(input.payload.height),
        measurementNotes:
          [
            extractString(input.payload.weightFluctuation?.explanation),
            extractString(input.payload.recentWeightChangeAmount),
            extractString(input.payload.recentWeightChangeTimeframe),
          ]
            .filter(Boolean)
            .join("; ") || undefined,
        trainingDaysPerWeek: extractNumber(input.payload.availableDaysPerWeek),
        preferredTrainingDays: input.payload.preferredTrainingDays,
        sessionLengthMinutes: String(input.payload.sessionDurationMinutes),
        nutritionFocus:
          [
            extractString(input.payload.currentNutritionBehavior),
            extractString(input.payload.dietaryRestrictions),
          ]
            .filter(Boolean)
            .join("; ") || undefined,
        sleepFocus:
          [extractString(input.payload.sleepHours), extractString(input.payload.sleepQuality)]
            .filter(Boolean)
            .join("; ") || undefined,
        stressLevel:
          [extractString(input.payload.stressWork), extractString(input.payload.stressHome)]
            .filter(Boolean)
            .join("; ") || undefined,
        injuryFlags:
          [
            extractString(input.payload.exercisesThatCausePain),
            extractString(input.payload.movementsExercisesPositionsAvoided),
            yesExplanation(input.payload.physicalLimitationsAggravatedByExercise),
            extractString(input.payload.knownDiagnoses),
          ]
            .filter(Boolean)
            .join("; ") || undefined,
        medicationFlags: summarizeMedications(input.payload.medications),
        motivationStyle:
          [
            extractString(input.payload.motivation),
            joinStrings(input.payload.preferredCoachingStyle),
          ]
            .filter(Boolean)
            .join("; ") || undefined,
        accountabilityPreference: joinStrings(input.payload.accountabilityPreference),
        internalTags: [
          "intake",
          input.payload.orchestrationMode ? `mode:${input.payload.orchestrationMode}` : undefined,
          input.payload.safetyStatus ? `safety:${input.payload.safetyStatus}` : undefined,
        ].filter((tag): tag is string => Boolean(tag)),
      });
    } catch (error) {
      throw withContext(error, "Client profile repository write failed");
    }

    return NextResponse.json(
      {
        data: {
          submission: serializeIntakeSubmission(submission),
          // Echo the validated payload so the client can drive plan generation
          // statelessly — required when serverless storage is per-Lambda and a
          // later /generate-plan invocation can't look it up.
          payload: input.payload,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error, {
      route: ROUTE_NAME,
      operation: "submit_intake",
      metadata: safeMetadata,
    });
  }
}
