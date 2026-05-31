import Link from "next/link";

import type { CompactClientProfile } from "@/lib/coaching/schemas/intakeSchema";

type AdminSubmissionDetails = CompactClientProfile & {
  email: string;
  status: string;
  submittedAt: string;
  notes: string;
};

const demoSubmissionDetails: AdminSubmissionDetails = {
  name: "Alex Rivera",
  email: "alex@example.com",
  status: "Ready for review",
  submittedAt: "May 29, 2026",
  goals: ["Build strength", "Move without pain"],
  availability: "4 days per week",
  equipment: ["Commercial gym", "Dumbbells at home", "Stationary bike"],
  constraints: ["Prefers morning sessions", "Travel twice per month"],
  safetySignals: ["Knee-friendly lower-body progressions needed"],
  nutritionSignals: [],
  missingInformation: [],
  notes:
    "Prefers morning sessions, wants knee-friendly lower-body progressions, and needs short travel workouts twice per month.",
};

type SubmissionDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminSubmissionDetailPage({ params }: SubmissionDetailPageProps) {
  const { id } = await params;

  return (
    <main className="page-shell narrow-shell">
      {/* TODO: Protect this admin route with authentication, authorization, and RBAC before sharing the URL publicly. */}
      <section className="warning-panel">
        <strong>Admin security TODO:</strong> This detail page is intentionally unauthenticated for
        v1. Add auth/RBAC before exposing real submission data or sharing this URL publicly.
      </section>

      <section className="hero-panel stack">
        <p className="eyebrow">Submission {id}</p>
        <h1>{demoSubmissionDetails.name}</h1>
        <p>
          Placeholder detail view for an individual coaching intake. Replace this demo payload with
          repository-backed data once admin protection is in place.
        </p>
      </section>

      <section className="card stack">
        <div className="section-heading">
          <h2>Client details</h2>
          <span>{demoSubmissionDetails.status}</span>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Email</dt>
            <dd>{demoSubmissionDetails.email}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{demoSubmissionDetails.submittedAt}</dd>
          </div>
          <div>
            <dt>Goals</dt>
            <dd>{demoSubmissionDetails.goals.join(", ")}</dd>
          </div>
          <div>
            <dt>Availability</dt>
            <dd>{demoSubmissionDetails.availability}</dd>
          </div>
          <div>
            <dt>Equipment</dt>
            <dd>{demoSubmissionDetails.equipment.join(", ")}</dd>
          </div>
          <div>
            <dt>Coach notes</dt>
            <dd>{demoSubmissionDetails.notes}</dd>
          </div>
        </dl>
        <Link className="button-link" href="/admin/submissions">
          Back to submissions
        </Link>
      </section>
    </main>
  );
}
