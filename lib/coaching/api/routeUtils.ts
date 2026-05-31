import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type CoachingExport,
  type CoachingPlan,
  type IntakeSubmission,
  type ReviewState,
} from "../db/coachingRepository";
import { jsonObjectSchema, jsonValueSchema } from "../schemas/intakeSchema";

export { jsonObjectSchema, jsonValueSchema };

export const documentIdSchema = z.string().trim().min(1).max(256);
export const userIdSchema = z.string().trim().min(1).max(256);

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "METHOD_NOT_ALLOWED"
  | "NOT_FOUND"
  | "PLAN_NOT_APPROVED"
  | "VALIDATION_ERROR";

type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    issues?: Array<{
      path: string;
      message: string;
    }>;
  };
};

export class ApiRouteError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  issues?: ApiErrorBody["error"]["issues"],
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(issues ? { issues } : {}),
      },
    } satisfies ApiErrorBody,
    { status },
  );
}

export function validationErrorResponse(error: z.ZodError) {
  return errorResponse(
    "VALIDATION_ERROR",
    "Request body failed validation.",
    400,
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  );
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiRouteError("BAD_REQUEST", "Request body must be valid JSON.", 400);
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof ApiRouteError) {
    return errorResponse(error.code, error.message, error.status);
  }

  if (error instanceof z.ZodError) {
    return validationErrorResponse(error);
  }

  return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
}

export function requireOwnedResource<T extends { userId: string }>(
  resource: T | null,
  userId: string,
  name: string,
): T {
  if (!resource) {
    throw new ApiRouteError("NOT_FOUND", `${name} was not found.`, 404);
  }

  if (resource.userId !== userId) {
    throw new ApiRouteError(
      "FORBIDDEN",
      `You do not have access to this ${name.toLowerCase()}.`,
      403,
    );
  }

  return resource;
}

export function isoDate(date: Date | undefined): string | undefined {
  return date?.toISOString();
}

export function serializeIntakeSubmission(submission: IntakeSubmission) {
  return {
    ...submission,
    createdAt: isoDate(submission.createdAt),
    updatedAt: isoDate(submission.updatedAt),
    submittedAt: isoDate(submission.submittedAt),
  };
}

export function serializeCoachingPlan(plan: CoachingPlan) {
  return {
    ...plan,
    createdAt: isoDate(plan.createdAt),
    updatedAt: isoDate(plan.updatedAt),
    publishedAt: isoDate(plan.publishedAt),
  };
}

export function serializeReviewState(reviewState: ReviewState) {
  return {
    ...reviewState,
    createdAt: isoDate(reviewState.createdAt),
    updatedAt: isoDate(reviewState.updatedAt),
  };
}

export function serializeCoachingExport(coachingExport: CoachingExport) {
  return {
    ...coachingExport,
    createdAt: isoDate(coachingExport.createdAt),
    updatedAt: isoDate(coachingExport.updatedAt),
    expiresAt: isoDate(coachingExport.expiresAt),
  };
}
