import Link from "next/link";

import { requireAdminPage } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import type { ClientProfile, IntakeSubmission } from "@/lib/coaching/db/coachingRepository";

export const dynamic = "force-dynamic";

type AdminClientsPageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

type ClientRow = {
  profile: ClientProfile;
  submission?: IntakeSubmission;
  primaryGoal: string;
  safetyStatus: string;
};

type ClientFilter = "active" | "follow-up-due" | "safety" | "archived";

const FILTERS: Array<{ key: ClientFilter; label: string; description: string }> = [
  {
    key: "active",
    label: "Active clients",
    description: "Currently active coaching relationships",
  },
  {
    key: "follow-up-due",
    label: "Follow-up due",
    description: "Clients with a follow-up date due today or earlier",
  },
  {
    key: "safety",
    label: "Safety caution / clearance",
    description: "Clients flagged for caution or medical clearance",
  },
  {
    key: "archived",
    label: "Archived clients",
    description: "Clients moved out of the active workspace",
  },
];

const SAFETY_LABELS: Record<string, string> = {
  clear: "Clear",
  caution: "Caution",
  medical_clearance_recommended: "Medical clearance",
};

function field(submission: IntakeSubmission | undefined, key: string): string {
  const payload = submission?.payload as unknown as Record<string, unknown> | undefined;
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
}

function humanize(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  const spaced = value.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatDate(date: Date | undefined): string {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function isDue(date: Date | undefined, now = new Date()): boolean {
  if (!date) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const followUpDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return followUpDay <= today;
}

function safetyLabel(safetyStatus: string): string {
  return SAFETY_LABELS[safetyStatus] ?? humanize(safetyStatus);
}

function safetyFromProfile(
  profile: ClientProfile,
  submission: IntakeSubmission | undefined,
): string {
  const submissionSafety = field(submission, "safetyStatus");
  if (submissionSafety) return submissionSafety;

  const safetyTag = profile.internalTags.find((tag) => tag.startsWith("safety:"));
  return safetyTag?.replace("safety:", "") ?? "";
}

function filterClients(rows: ClientRow[], filter: ClientFilter): ClientRow[] {
  return rows.filter(({ profile, safetyStatus }) => {
    if (filter === "active") return profile.status !== "archived";
    if (filter === "follow-up-due") return isDue(profile.nextFollowUpDate);
    if (filter === "safety") {
      return safetyStatus === "caution" || safetyStatus === "medical_clearance_recommended";
    }
    return profile.status === "archived";
  });
}

async function loadClients(): Promise<{ rows: ClientRow[]; error?: string }> {
  try {
    const repository = createCoachingRepository();
    const profiles = await repository.listAllClientProfiles(300);
    const rows = await Promise.all(
      profiles.map(async (profile) => {
        const submission = await repository
          .getIntakeSubmission(profile.intakeSubmissionId)
          .catch(() => null);
        return {
          profile,
          submission: submission ?? undefined,
          primaryGoal: field(submission ?? undefined, "mainGoal"),
          safetyStatus: safetyFromProfile(profile, submission ?? undefined),
        };
      }),
    );

    return { rows };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Failed to load client profiles.",
    };
  }
}

export default async function AdminClientsPage({ searchParams }: AdminClientsPageProps) {
  await requireAdminPage("/admin/clients");
  const params = await searchParams;
  const selectedFilter = FILTERS.some((filter) => filter.key === params?.filter)
    ? (params?.filter as ClientFilter)
    : "active";
  const { rows, error } = await loadClients();
  const visibleRows = filterClients(rows, selectedFilter);

  return (
    <main className="page-shell">
      <section className="warning-panel">
        <strong>Admin security TODO:</strong> This CRM workspace contains medical/PII client data —
        keep auth/RBAC enabled before sharing it.
      </section>

      <section className="hero-panel stack">
        <p className="eyebrow">Admin CRM</p>
        <h1>Client profiles</h1>
        <p>
          Use this as the main coaching CRM workspace. Intake submissions remain available as the
          queue at <Link href="/admin/submissions">/admin/submissions</Link>.
        </p>
      </section>

      <section className="card stack">
        <div className="section-heading">
          <h2>Client workspace</h2>
          <span>
            {visibleRows.length} shown / {rows.length} total
          </span>
        </div>

        <nav className="filter-tabs" aria-label="Client filters">
          {FILTERS.map((filter) => (
            <Link
              key={filter.key}
              className={filter.key === selectedFilter ? "filter-tab active" : "filter-tab"}
              href={`/admin/clients?filter=${filter.key}`}
              title={filter.description}
            >
              {filter.label}
            </Link>
          ))}
        </nav>

        {error ? <p className="error-text">{error}</p> : null}

        {visibleRows.length === 0 && !error ? (
          <p className="muted-copy">
            No clients match this filter yet. Review new intake records in the{" "}
            <Link href="/admin/submissions">intake queue</Link>.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client name</th>
                  <th>Email / phone</th>
                  <th>Primary goal</th>
                  <th>Coaching status</th>
                  <th>Start date</th>
                  <th>Next follow-up</th>
                  <th>Safety status</th>
                  <th>Last updated</th>
                  <th>Client page</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ profile, submission, primaryGoal, safetyStatus }) => (
                  <tr key={profile.id}>
                    <td>{profile.fullName || "Unnamed client"}</td>
                    <td>
                      <div>{profile.email || field(submission, "email") || "—"}</div>
                      <div className="muted-copy">
                        {profile.phone || field(submission, "phoneNumber") || "—"}
                      </div>
                    </td>
                    <td>{humanize(primaryGoal)}</td>
                    <td>{humanize(profile.status)}</td>
                    <td>{formatDate(profile.startDate)}</td>
                    <td>{formatDate(profile.nextFollowUpDate)}</td>
                    <td>{safetyLabel(safetyStatus)}</td>
                    <td>{formatDate(profile.updatedAt)}</td>
                    <td>
                      <Link href={`/admin/submissions/${profile.intakeSubmissionId}`}>
                        Open client
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
