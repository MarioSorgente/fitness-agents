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
