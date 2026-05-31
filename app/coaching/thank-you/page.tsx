import Link from "next/link";

import { CoachingThankYouView } from "./CoachingThankYouView";

type CoachingThankYouPageProps = {
  searchParams: Promise<{
    submissionId?: string;
    userId?: string;
  }>;
};

export default async function CoachingThankYouPage({ searchParams }: CoachingThankYouPageProps) {
  const { submissionId, userId } = await searchParams;

  return (
    <main className="page-shell narrow-shell">
      <section className="hero-panel stack">
        <p className="eyebrow">Intake received</p>
        <h1>Thank you — generating your coaching plan.</h1>
        <p>
          Your submission has been saved and the coaching agents are drafting a plan from your
          goals, constraints, and equipment. This usually takes 10–30 seconds.
        </p>
        {submissionId ? (
          <p className="submission-reference">Submission reference: {submissionId}</p>
        ) : null}
      </section>

      {submissionId ? (
        <CoachingThankYouView submissionId={submissionId} userId={userId} />
      ) : (
        <section className="card stack">
          <h2>No submission reference found</h2>
          <p>
            We couldn&apos;t find a submission id on this URL. Please submit the intake form again
            to generate a plan.
          </p>
          <div className="button-row">
            <Link className="button-link" href="/coaching/intake">
              Submit intake
            </Link>
          </div>
        </section>
      )}

      <section className="card stack">
        <div className="button-row">
          <Link className="button-link" href="/coaching/intake">
            Submit another intake
          </Link>
          <Link className="secondary-link" href="/">
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}
