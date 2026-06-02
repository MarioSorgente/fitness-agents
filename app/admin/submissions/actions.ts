"use server";

import { redirect } from "next/navigation";

import { verifyAdminSession } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import { sampleIntakeFormData } from "@/lib/coaching/form/sampleIntake";
import { coachingIntakeSchema } from "@/lib/coaching/schemas/intakeSchema";

/**
 * Admin-only: seed a realistic dummy intake submission so the full
 * generate → edit → PDF flow can be tested without filling the public form.
 * Lands on the new submission's detail page, ready for "Generate draft".
 */
export async function seedTestSubmission() {
  const admin = await verifyAdminSession();
  if (!admin) {
    redirect("/admin/login?from=/admin/submissions");
  }

  const now = new Date();
  const stamp = now.toISOString().slice(11, 19); // HH:MM:SS — makes each test client distinct
  const payload = coachingIntakeSchema.parse({
    ...sampleIntakeFormData,
    fullName: `Test Client ${stamp}`,
    email: `test+${now.getTime()}@example.com`,
  });

  const repository = createCoachingRepository();
  const submission = await repository.createIntakeSubmission({
    userId: payload.email,
    payload,
    status: "queued",
    submittedAt: now,
  });

  redirect(`/admin/submissions/${submission.id}`);
}
