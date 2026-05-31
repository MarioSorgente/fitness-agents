import { NextResponse } from "next/server";
import { z } from "zod";

import {
  handleRouteError,
  parseJsonBody,
  serializeIntakeSubmission,
  userIdSchema,
} from "@/lib/coaching/api/routeUtils";
import { coachingIntakeSchema } from "@/lib/coaching/schemas/intakeSchema";
import { createFirebaseCoachingRepository } from "@/lib/coaching/db/firebaseCoachingRepository";

export const runtime = "nodejs";

const submitIntakeSchema = z.object({
  id: z.string().trim().min(1).max(256).optional(),
  userId: userIdSchema,
  payload: coachingIntakeSchema,
});

export async function POST(request: Request) {
  try {
    const input = submitIntakeSchema.parse(await parseJsonBody(request));
    const repository = createFirebaseCoachingRepository();
    const submittedAt = new Date();

    const submission = await repository.createIntakeSubmission({
      id: input.id,
      userId: input.userId,
      payload: input.payload,
      status: "queued",
      submittedAt,
    });

    return NextResponse.json(
      {
        data: {
          submission: serializeIntakeSubmission(submission),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
