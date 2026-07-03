import Link from "next/link";

import { requireAdminPage } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import type { ClientProfile, IntakeSubmission } from "@/lib/coaching/db/coachingRepository";

import { IntakeSnapshot, field, humanize, joinList } from "../../submissions/IntakeSnapshot";
import { SubmissionWorkflow } from "../../submissions/SubmissionWorkflow";
import { ClientAssetManager } from "./ClientAssetManager";
import { ClientCrmForm } from "./ClientCrmForm";

export const dynamic = "force-dynamic";

type AdminClientDetailPageProps = {
  params: Promise<{ id: string }>;
};

type ClientDetail = {
  profile?: ClientProfile;
  submission?: IntakeSubmission;
  initialPlanId?: string;
  initialMarkdown?: string;
  error?: string;
};

function formatDate(date: Date | undefined): string {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

async function loadDetail(id: string): Promise<ClientDetail> {
  try {
    const repository = createCoachingRepository();
    const profile = await repository.getClientProfile(id);
    if (!profile) return {};

    const submission = await repository.getIntakeSubmission(profile.intakeSubmissionId);
    let initialPlanId: string | undefined;
    let initialMarkdown: string | undefined;

    if (submission) {
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
        // Plan lookup is best-effort so CRM editing never blocks the generation workflow.
      }
    }

    return { profile, submission: submission ?? undefined, initialPlanId, initialMarkdown };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to load client profile." };
  }
}

export default async function AdminClientDetailPage({ params }: AdminClientDetailPageProps) {
  const { id } = await params;
  await requireAdminPage(`/admin/clients/${id}`);
  const { profile, submission, initialPlanId, initialMarkdown, error } = await loadDetail(id);

  if (error) {
    return (
      <main className="page-shell narrow-shell">
        <section className="card stack">
          <h1>Could not load client</h1>
          <p className="error-text">{error}</p>
          <Link className="button-link" href="/admin/clients">
            Back to clients
          </Link>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="page-shell narrow-shell">
        <section className="card stack">
          <h1>Client not found</h1>
          <p className="muted-copy">No client profile matches id {id}.</p>
          <Link className="button-link" href="/admin/clients">
            Back to clients
          </Link>
        </section>
      </main>
    );
  }

  const payload = (submission?.payload ?? {}) as unknown as Record<string, unknown>;
  const displayName = profile.fullName || field(payload, "fullName") || "Unnamed client";
  const nutritionConstraints =
    [
      field(payload, "dietaryRestrictions"),
      field(payload, "foodAllergies"),
      field(payload, "foodIntolerances"),
    ]
      .filter(Boolean)
      .join("; ") || "—";
  const injuryMedicalNotes =
    [
      field(payload, "knownDiagnoses"),
      field(payload, "otherDiagnosedConditions"),
      field(payload, "physicalLimitationsAggravatedByExercise"),
      field(payload, "exercisesThatCausePain"),
    ]
      .filter(Boolean)
      .join("; ") || "—";
  const availability =
    [
      field(payload, "availableDaysPerWeek")
        ? `${field(payload, "availableDaysPerWeek")} days/week`
        : "",
      field(payload, "sessionDurationMinutes")
        ? `${field(payload, "sessionDurationMinutes")} min/session`
        : "",
      joinList(payload.preferredTrainingDays) !== "—"
        ? joinList(payload.preferredTrainingDays)
        : "",
    ]
      .filter(Boolean)
      .join("; ") || "—";

  return (
    <main className="page-shell">
      <section className="warning-panel">
        <strong>Admin security TODO:</strong> This client CRM page contains medical/PII client data
        — keep auth/RBAC enabled before sharing it.
      </section>

      <section className="hero-panel stack">
        <p className="eyebrow">Client profile {profile.id}</p>
        <h1>{displayName}</h1>
        <p>{profile.email || field(payload, "email") || "No email provided"}</p>
        <div className="button-row">
          <Link className="secondary-link" href="/admin/clients">
            ← Back to clients
          </Link>
          {submission ? (
            <Link className="secondary-link" href={`/admin/submissions/${submission.id}`}>
              Intake submission
            </Link>
          ) : null}
        </div>
      </section>

      <section className="card stack">
        <h2>Client overview</h2>
        <dl className="detail-list">
          <div>
            <dt>Name</dt>
            <dd>{displayName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile.email || field(payload, "email") || "—"}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{profile.phone || field(payload, "phoneNumber") || "—"}</dd>
          </div>
          <div>
            <dt>Main goal</dt>
            <dd>{humanize(field(payload, "mainGoal"))}</dd>
          </div>
          <div>
            <dt>Training level</dt>
            <dd>{humanize(field(payload, "trainingLevel"))}</dd>
          </div>
          <div>
            <dt>Safety status</dt>
            <dd>{humanize(field(payload, "safetyStatus"))}</dd>
          </div>
          <div>
            <dt>Equipment</dt>
            <dd>{joinList(payload.equipmentAvailable)}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{availability}</dd>
          </div>
          <div>
            <dt>Nutrition constraints</dt>
            <dd>{nutritionConstraints}</dd>
          </div>
          <div>
            <dt>Injury/medical notes</dt>
            <dd>{injuryMedicalNotes}</dd>
          </div>
          <div>
            <dt>Starting date</dt>
            <dd>{formatDate(profile.startDate)}</dd>
          </div>
          <div>
            <dt>Next follow-up</dt>
            <dd>{formatDate(profile.nextFollowUpDate)}</dd>
          </div>
        </dl>
      </section>

      {submission ? (
        <IntakeSnapshot payload={payload} title="Intake overview" includeContact />
      ) : (
        <section className="card stack">
          <h2>Intake overview</h2>
          <p className="muted-copy">The original intake submission could not be found.</p>
        </section>
      )}

      <ClientAssetManager
        clientId={profile.id}
        initialPlanImages={profile.planImages}
        initialProgressPhotos={profile.progressPhotos}
      />

      <ClientCrmForm profile={profile} />

      {submission ? (
        <SubmissionWorkflow
          submissionId={submission.id}
          userId={submission.userId}
          payload={payload}
          initialPlanId={initialPlanId}
          initialMarkdown={initialMarkdown}
        />
      ) : null}
    </main>
  );
}
