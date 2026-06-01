import { z } from "zod";

import {
  documentIdSchema,
  errorResponse,
  parseJsonBody,
  requireOwnedResource,
  userIdSchema,
} from "@/lib/coaching/api/routeUtils";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import { buildCoachingTextFallback } from "@/lib/coaching/orchestration/buildTextFallback";
import {
  COACHING_AGENT_TIMELINE,
  type CoachingProgressEvent,
  generateCoachingPlan,
} from "@/lib/coaching/orchestration/generateCoachingPlan";

export const runtime = "nodejs";
// Allow up to 5 minutes for the full multi-agent orchestration on Vercel Fluid Compute.
export const maxDuration = 300;

const generatePlanSchema = z.object({
  userId: userIdSchema,
  intakeSubmissionId: documentIdSchema,
  orchestrationMode: z.enum(["test", "production"]).default("test"),
});

type StreamEvent =
  | { kind: "intake_loaded"; submissionId: string }
  | { kind: "timeline"; steps: Array<{ step: string; title: string }> }
  | CoachingProgressEvent
  | {
      kind: "plan_ready";
      planId: string;
      reviewStateId?: string;
    }
  | {
      kind: "plan_text_fallback";
      planId: string;
      reason: string;
      planText: string;
    }
  | { kind: "error"; message: string; details?: { name: string; message: string } }
  | { kind: "done" };

function sseLine(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  // Parse and validate up-front so client gets a normal JSON 4xx for bad input.
  let input: z.infer<typeof generatePlanSchema>;
  try {
    input = generatePlanSchema.parse(await parseJsonBody(request));
  } catch (error) {
    if (error instanceof z.ZodError) {
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
    const message = error instanceof Error ? error.message : "Invalid request.";
    return errorResponse("BAD_REQUEST", message, 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(sseLine(event)));
      };

      try {
        const repository = createCoachingRepository();
        const intakeSubmission = requireOwnedResource(
          await repository.getIntakeSubmission(input.intakeSubmissionId),
          input.userId,
          "Intake submission",
        );
        send({ kind: "intake_loaded", submissionId: intakeSubmission.id });
        send({
          kind: "timeline",
          steps: COACHING_AGENT_TIMELINE.map((entry) => ({
            step: entry.step,
            title: entry.title,
          })),
        });

        const generatedAt = new Date();

        try {
          const generated = await generateCoachingPlan({
            intakePayload: intakeSubmission.payload,
            mode: input.orchestrationMode,
            onProgress: (event) => send(event),
          });

          const plan = await repository.createCoachingPlan({
            userId: input.userId,
            intakeSubmissionId: intakeSubmission.id,
            status: "ready",
            plan: {
              ...generated.plan,
              generatedAt: generatedAt.toISOString(),
            },
            agentOutputs: {
              ...generated.agentOutputs,
              generatedAt: generatedAt.toISOString(),
            },
          });

          const reviewState = await repository.upsertReviewState({
            userId: input.userId,
            planId: plan.id,
            status: "in_review",
          });

          send({ kind: "plan_ready", planId: plan.id, reviewStateId: reviewState.id });
        } catch (agentError) {
          const reason =
            agentError instanceof Error ? agentError.message : "AI provider error";
          console.warn("[coaching plan] agent pipeline failed; using text fallback:", reason);

          const planText = buildCoachingTextFallback(intakeSubmission.payload, reason);
          const fallbackPlan = await repository.createCoachingPlan({
            userId: input.userId,
            intakeSubmissionId: intakeSubmission.id,
            status: "ready",
            plan: {
              version: 1,
              orchestrationMode: input.orchestrationMode,
              source: "api/coaching/generate-plan",
              generatedAt: generatedAt.toISOString(),
              content: {
                mode: "text_fallback",
                reason,
                planText,
              },
            },
            agentOutputs: {
              status: "text_fallback",
              generatedAt: generatedAt.toISOString(),
              expertOutputs: [],
            },
          });

          send({
            kind: "plan_text_fallback",
            planId: fallbackPlan.id,
            reason,
            planText,
          });
        }
      } catch (error) {
        console.error("[coaching plan] stream error", error);
        const details =
          error instanceof Error
            ? { name: error.name || "Error", message: error.message }
            : { name: "UnknownError", message: String(error) };
        send({ kind: "error", message: details.message, details });
      } finally {
        send({ kind: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
