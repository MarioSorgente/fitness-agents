import Link from "next/link";

import { requireAdminPage } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import type { IntakeSubmission } from "@/lib/coaching/db/coachingRepository";
import type { CompactClientProfile } from "@/lib/coaching/schemas/intakeSchema";

import { SubmissionWorkflow } from "../SubmissionWorkflow";

export const dynamic = "force-dynamic";

type SubmissionDetailPageProps = {
  params: Promise<{ id: string }>;
};

function field(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function humanize(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  const spaced = value.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function joinList(value: unknown): string {
  if (!Array.isArray(value)) return "—";
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items.map(humanize).join(", ") : "—";
}

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
  const profile = (payload.clientProfile as CompactClientProfile | undefined) ?? undefined;
  const name = field(payload, "fullName") || profile?.name || "Unnamed client";

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

      <section className="card stack">
        <h2>Client snapshot</h2>
        <dl className="detail-list">
          <div>
            <dt>Primary goal</dt>
            <dd>{humanize(field(payload, "mainGoal"))}</dd>
          </div>
          <div>
            <dt>Goal detail</dt>
            <dd>{field(payload, "specificGoalDescription") || "—"}</dd>
          </div>
          <div>
            <dt>Training level</dt>
            <dd>{humanize(field(payload, "trainingLevel"))}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{profile?.availability || "—"}</dd>
          </div>
          <div>
            <dt>Equipment</dt>
            <dd>{joinList(payload.equipmentAvailable)}</dd>
          </div>
          <div>
            <dt>Safety status</dt>
            <dd>{humanize(field(payload, "safetyStatus"))}</dd>
          </div>
        </dl>
      </section>

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
