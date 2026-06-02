import Link from "next/link";

import { requireAdminPage } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import type { IntakeSubmission } from "@/lib/coaching/db/coachingRepository";

import { seedTestSubmission } from "./actions";

export const dynamic = "force-dynamic";

function humanize(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  const spaced = value.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function clientField(submission: IntakeSubmission, key: string): string {
  const payload = submission.payload as unknown as Record<string, unknown>;
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function formatDate(date: Date | undefined): string {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

const SAFETY_BADGE: Record<string, string> = {
  clear: "Clear",
  caution: "Caution",
  medical_clearance_recommended: "Medical clearance",
};

async function loadSubmissions(): Promise<{ submissions: IntakeSubmission[]; error?: string }> {
  try {
    const repository = createCoachingRepository();
    const submissions = await repository.listAllIntakeSubmissions(200);
    return { submissions };
  } catch (error) {
    return {
      submissions: [],
      error: error instanceof Error ? error.message : "Failed to load submissions.",
    };
  }
}

export default async function AdminSubmissionsPage() {
  await requireAdminPage("/admin/submissions");
  const { submissions, error } = await loadSubmissions();

  return (
    <main className="page-shell">
      {/* TODO: Protect this admin route with authentication, authorization, and RBAC before sharing the URL publicly. */}
      <section className="warning-panel">
        <strong>Admin security TODO:</strong> This admin area is unauthenticated. It exposes
        medical/PII intake data — add auth/RBAC before sharing this URL or collecting real clients.
      </section>

      <section className="hero-panel">
        <p className="eyebrow">Admin</p>
        <h1>Coaching intake submissions</h1>
        <p>
          Select a client to review their intake, generate an editable coaching document, and export
          a PDF. The public form lives at <code>/intake</code>.
        </p>
      </section>

      <section className="card stack">
        <div className="section-heading">
          <h2>Submissions</h2>
          <span>
            {submissions.length} {submissions.length === 1 ? "record" : "records"}
          </span>
        </div>

        <div className="button-row">
          <form action={seedTestSubmission}>
            <button type="submit" className="secondary-button">
              Create test client (dummy data)
            </button>
          </form>
          <span className="muted-copy">
            Seeds a sample intake and opens it, so you can run the full generate → edit → PDF flow.
          </span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {submissions.length === 0 && !error ? (
          <p className="muted-copy">
            No submissions yet. Share the <Link href="/intake">intake form</Link> to start collecting
            clients.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Email</th>
                  <th>Primary goal</th>
                  <th>Safety</th>
                  <th>Submitted</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const safety = clientField(submission, "safetyStatus");
                  return (
                    <tr key={submission.id}>
                      <td>{clientField(submission, "fullName") || "Unnamed client"}</td>
                      <td>{clientField(submission, "email") || "—"}</td>
                      <td>{humanize(clientField(submission, "mainGoal"))}</td>
                      <td>{SAFETY_BADGE[safety] ?? humanize(safety)}</td>
                      <td>{formatDate(submission.submittedAt ?? submission.createdAt)}</td>
                      <td>
                        <Link href={`/admin/submissions/${submission.id}`}>Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
