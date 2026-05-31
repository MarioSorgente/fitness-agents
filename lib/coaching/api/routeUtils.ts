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
  | "CONFIGURATION_ERROR"
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

type RouteErrorContext = {
  route?: string;
  operation?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function isNamedError(error: unknown, name: string): boolean {
  return error instanceof Error && error.name === name;
}

function knownErrorResponse(error: unknown) {
  const message = errorMessage(error);

  if (isNamedError(error, "CoachingRepositoryConfigError")) {
    return errorResponse("CONFIGURATION_ERROR", message, 500);
  }

  if (
    message.includes("FIREBASE_SERVICE_ACCOUNT_KEY") ||
    message.includes("FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY")
  ) {
    return errorResponse(
      "CONFIGURATION_ERROR",
      "Firebase Admin credentials are incomplete or invalid. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.",
      500,
    );
  }

  if (
    message.includes("Failed to parse private key") ||
    message.includes("Firebase") ||
    message.includes("Firestore")
  ) {
    return errorResponse(
      "CONFIGURATION_ERROR",
      "Firebase Admin initialization or Firestore write failed. Check server logs and Firebase Admin environment variables.",
      500,
    );
  }

  if (message.includes("Local repository write failed")) {
    return errorResponse(
      "INTERNAL_ERROR",
      "Local repository write failed. Check COACHING_LOCAL_STORE_PATH permissions or use COACHING_REPOSITORY=local with a writable path.",
      500,
    );
  }

  if (message.includes("Intake repository write failed")) {
    return errorResponse(
      "INTERNAL_ERROR",
      "Intake submission could not be saved. Check the selected repository configuration and server logs.",
      500,
    );
  }

  if (message.startsWith("No AI route succeeded")) {
    return errorResponse(
      "CONFIGURATION_ERROR",
      `AI generation failed because no provider route succeeded. ${message}`,
      500,
    );
  }

  return undefined;
}

function logRouteError(error: unknown, context?: RouteErrorContext) {
  const logPayload = {
    route: context?.route ?? "unknown route",
    operation: context?.operation,
    timestamp: new Date().toISOString(),
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: errorMessage(error),
    metadata: context?.metadata,
  };

  console.error("[coaching-api] route error", logPayload);
}

export function handleRouteError(error: unknown, context?: RouteErrorContext) {
  logRouteError(error, context);

  if (error instanceof ApiRouteError) {
    return errorResponse(error.code, error.message, error.status);
  }

  if (error instanceof z.ZodError) {
    return validationErrorResponse(error);
  }

  const response = knownErrorResponse(error);
  if (response) {
    return response;
  }

  return errorResponse(
    "INTERNAL_ERROR",
    "An unexpected error occurred. Check server logs for details.",
    500,
  );
}

export function requireAdminAccess(request: Request) {
  const expectedKey = process.env.ADMIN_ACCESS_KEY;

  if (!expectedKey) {
    throw new ApiRouteError(
      "CONFIGURATION_ERROR",
      "ADMIN_ACCESS_KEY is not configured for this admin-only endpoint.",
      500,
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : undefined;
  const submittedKey = request.headers.get("x-admin-access-key") ?? bearerToken;

  if (submittedKey !== expectedKey) {
    throw new ApiRouteError("FORBIDDEN", "Admin access key is missing or invalid.", 403);
  }
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
