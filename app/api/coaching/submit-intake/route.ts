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

    return NextResponse.json(
      {
        data: {
          submission: serializeIntakeSubmission(submission),
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
