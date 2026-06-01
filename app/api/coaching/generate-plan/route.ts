import { z } from "zod";

import { randomUUID } from "node:crypto";

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
import type { CoachingPlanContent } from "@/lib/coaching/schemas/coachingPlanSchema";
import { coachingIntakeSchema } from "@/lib/coaching/schemas/intakeSchema";

export const runtime = "nodejs";
// Allow up to 5 minutes for the full multi-agent orchestration on Vercel Fluid Compute.
export const maxDuration = 300;

const generatePlanSchema = z
  .object({
    userId: userIdSchema,
    intakeSubmissionId: documentIdSchema.optional(),
    // Inline intake payload — preferred path. Eliminates the cross-Lambda lookup
    // that fails on Vercel's per-invocation local storage.
    intakePayload: coachingIntakeSchema.optional(),
    orchestrationMode: z.enum(["test", "production"]).default("test"),
  })
  .refine((value) => Boolean(value.intakePayload || value.intakeSubmissionId), {
    message: "Either intakePayload or intakeSubmissionId must be provided.",
    path: ["intakePayload"],
  });

type StreamEvent =
  | { kind: "intake_loaded"; submissionId: string }
  | { kind: "timeline"; steps: Array<{ step: string; title: string }> }
  | CoachingProgressEvent
  | {
      kind: "plan_ready";
      planId: string;
      reviewStateId?: string;
      // Full plan content streamed inline so the client can render the PDF without
      // a second server round-trip — critical when storage is ephemeral (Vercel local mode).
      plan: CoachingPlanContent;
      userId: string;
      intakeSubmissionId: string;
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
        let intakePayload: typeof input.intakePayload;
        let submissionId: string;

        if (input.intakePayload) {
          // Stateless path: client supplied the validated intake directly.
          intakePayload = input.intakePayload;
          submissionId = input.intakeSubmissionId ?? randomUUID();
        } else if (input.intakeSubmissionId) {
          // Stateful path: look up the submission (only works when the same Lambda
          // handled submit-intake or when Firebase persistence is healthy).
          const repository = createCoachingRepository();
          const intakeSubmission = requireOwnedResource(
            await repository.getIntakeSubmission(input.intakeSubmissionId),
            input.userId,
            "Intake submission",
          );
          intakePayload = intakeSubmission.payload;
          submissionId = intakeSubmission.id;
        } else {
          throw new Error("intakePayload or intakeSubmissionId is required.");
        }

        send({ kind: "intake_loaded", submissionId });
        send({
          kind: "timeline",
          steps: COACHING_AGENT_TIMELINE.map((entry) => ({
            step: entry.step,
            title: entry.title,
          })),
        });

        const generatedAt = new Date();
        const planId = randomUUID();

        try {
          const generated = await generateCoachingPlan({
            intakePayload,
            mode: input.orchestrationMode,
            onProgress: (event) => send(event),
          });

          const planContent: CoachingPlanContent = {
            ...generated.plan,
            generatedAt: generatedAt.toISOString(),
          };

          // Best-effort persistence — never blocks the response. On Vercel local-mode
          // this often won't survive past the current Lambda; the inline plan we send
          // to the client is what powers PDF download.
          void (async () => {
            try {
              const repository = createCoachingRepository();
              await repository.createCoachingPlan({
                id: planId,
                userId: input.userId,
                intakeSubmissionId: submissionId,
                status: "ready",
                plan: planContent,
                agentOutputs: {
                  ...generated.agentOutputs,
                  generatedAt: generatedAt.toISOString(),
                },
              });
              await repository.upsertReviewState({
                userId: input.userId,
                planId,
                status: "in_review",
              });
            } catch (persistError) {
              console.warn(
                "[coaching plan] best-effort plan persistence failed:",
                persistError instanceof Error ? persistError.message : persistError,
              );
            }
          })();

          send({
            kind: "plan_ready",
            planId,
            plan: planContent,
            userId: input.userId,
            intakeSubmissionId: submissionId,
          });
        } catch (agentError) {
          const reason =
            agentError instanceof Error ? agentError.message : "AI provider error";
          console.warn("[coaching plan] agent pipeline failed; using text fallback:", reason);

          const planText = buildCoachingTextFallback(intakePayload, reason);
          send({
            kind: "plan_text_fallback",
            planId,
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
