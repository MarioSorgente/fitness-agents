import Link from "next/link";

import { requireAdminPage } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import type { IntakeSubmission } from "@/lib/coaching/db/coachingRepository";
import { IntakeSnapshot, field } from "../IntakeSnapshot";
import { SubmissionWorkflow } from "../SubmissionWorkflow";

export const dynamic = "force-dynamic";

type SubmissionDetailPageProps = {
  params: Promise<{ id: string }>;
};

async function loadDetail(id: string): Promise<{
  submission?: IntakeSubmission;
  initialPlanId?: string;
  initialMarkdown?: string;
  error?: string;
}> {
  try {
    const repository = createCoachingRepository();
    const submission = await repository.getIntakeSubmission(id);
    if (!submission) return {};

    let initialPlanId: string | undefined;
    let initialMarkdown: string | undefined;
    try {
      const plans = await repository.listCoachingPlans({ userId: submission.userId });
      const match = plans.find(
        (plan) =>
          plan.intakeSubmissionId === submission.id && typeof plan.plan?.markdown === "string",
      );
      if (match) {
        initialPlanId = match.id;
        initialMarkdown = match.plan.markdown as string;
      }
    } catch {
      // Plan lookup is best-effort; a missing draft just means "Generate" starts fresh.
    }

    return { submission, initialPlanId, initialMarkdown };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to load submission." };
  }
}

export default async function AdminSubmissionDetailPage({ params }: SubmissionDetailPageProps) {
  const { id } = await params;
  await requireAdminPage(`/admin/submissions/${id}`);
  const { submission, initialPlanId, initialMarkdown, error } = await loadDetail(id);

  if (error) {
    return (
      <main className="page-shell narrow-shell">
        <section className="card stack">
          <h1>Could not load submission</h1>
          <p className="error-text">{error}</p>
          <Link className="button-link" href="/admin/submissions">
            Back to submissions
          </Link>
        </section>
      </main>
    );
  }

  if (!submission) {
    return (
      <main className="page-shell narrow-shell">
        <section className="card stack">
          <h1>Submission not found</h1>
          <p className="muted-copy">No intake submission matches id {id}.</p>
          <Link className="button-link" href="/admin/submissions">
            Back to submissions
          </Link>
        </section>
      </main>
    );
  }

  const payload = submission.payload as unknown as Record<string, unknown>;
  const name = field(payload, "fullName") || "Unnamed client";

  return (
    <main className="page-shell">
      {/* TODO: Protect this admin route with authentication, authorization, and RBAC before sharing the URL publicly. */}
      <section className="warning-panel">
        <strong>Admin security TODO:</strong> Unauthenticated detail view containing medical/PII
        data. Add auth/RBAC before exposing real client data.
      </section>

      <section className="hero-panel stack">
        <p className="eyebrow">Submission {submission.id}</p>
        <h1>{name}</h1>
        <p>{field(payload, "email") || "No email provided"}</p>
        <div>
          <Link className="secondary-link" href="/admin/submissions">
            ← Back to submissions
          </Link>
        </div>
      </section>

      <IntakeSnapshot payload={payload} />

      <SubmissionWorkflow
        submissionId={submission.id}
        userId={submission.userId}
        payload={payload}
        initialPlanId={initialPlanId}
        initialMarkdown={initialMarkdown}
      />
    </main>
  );
}
