import Link from "next/link";

export default function CoachingThankYouPage() {
  return (
    <main className="page-shell narrow-shell">
      <section className="hero-panel stack">
        <p className="eyebrow">Intake received</p>
        <h1>Thank you — your coaching intake is ready for review.</h1>
        <p>
          In v1, this page confirms the intake flow and sets expectations while persistence,
          notifications, and plan generation are connected behind the scenes.
        </p>
      </section>

      <section className="card stack">
        <h2>What happens next?</h2>
        <ol className="timeline-list">
          <li>Mario reviews your intake details for completeness.</li>
          <li>The coaching agents draft a training plan from your goals and constraints.</li>
          <li>A human review pass approves the plan before it is shared with you.</li>
        </ol>
        <Link className="button-link" href="/coaching/intake">
          Submit another intake
        </Link>
      </section>
    </main>
  );
}
