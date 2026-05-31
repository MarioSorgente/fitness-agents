import Link from "next/link";

type CoachingThankYouPageProps = {
  searchParams: Promise<{
    submissionId?: string;
  }>;
};

export default async function CoachingThankYouPage({ searchParams }: CoachingThankYouPageProps) {
  const { submissionId } = await searchParams;

  return (
    <main className="page-shell narrow-shell">
      <section className="hero-panel stack">
        <p className="eyebrow">Intake received</p>
        <h1>Thank you — your coaching intake is ready for review.</h1>
        <p>
          Your submission has been saved and can now move into coaching-plan generation, review, and
          PDF export when the backend environment is configured.
        </p>
        {submissionId ? (
          <p className="submission-reference">Submission reference: {submissionId}</p>
        ) : null}
      </section>

      <section className="card stack">
        <h2>What happens next?</h2>
        <ol className="timeline-list">
          <li>Mario reviews your intake details for completeness.</li>
          <li>The coaching agents draft a training plan from your goals and constraints.</li>
          <li>A human review pass approves the plan before it is shared with you.</li>
        </ol>
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
