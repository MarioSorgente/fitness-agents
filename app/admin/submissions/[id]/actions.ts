"use server";

import { redirect } from "next/navigation";

import { requireAdminPage } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";

function valueAsString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function connectSubmissionToCrm(submissionId: string) {
  await requireAdminPage(`/admin/submissions/${submissionId}`);

  const repository = createCoachingRepository();
  const submission = await repository.getIntakeSubmission(submissionId);
  if (!submission) {
    throw new Error(`Intake submission ${submissionId} does not exist.`);
  }

  const existingProfile = await repository.getClientProfileBySubmissionId(submission.id);
  if (existingProfile) {
    redirect(`/admin/clients/${existingProfile.id}`);
  }

  const payload = submission.payload as unknown as Record<string, unknown>;
  const profile = await repository.createClientProfile({
    userId: submission.userId,
    intakeSubmissionId: submission.id,
    fullName: valueAsString(payload.fullName) ?? "Unnamed client",
    email: valueAsString(payload.email) ?? "unknown@example.invalid",
    phone: valueAsString(payload.phoneNumber),
    status: "lead",
    priority: payload.safetyStatus === "medical_clearance_recommended" ? "high" : "normal",
    internalTags: [
      "intake",
      valueAsString(payload.orchestrationMode)
        ? `mode:${valueAsString(payload.orchestrationMode)}`
        : undefined,
      valueAsString(payload.safetyStatus)
        ? `safety:${valueAsString(payload.safetyStatus)}`
        : undefined,
    ].filter((tag): tag is string => Boolean(tag)),
  });

  redirect(`/admin/clients/${profile.id}`);
}
