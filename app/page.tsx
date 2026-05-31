import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-panel home-hero">
        <div className="stack">
          <p className="eyebrow">Fitness Agents</p>
          <h1>Multi-agent coaching plans with human review.</h1>
          <p>
            Collect an intake, route it through specialist coaching agents, review the result, and
            export a polished coaching PDF when the plan is approved.
          </p>
          <div className="button-row">
            <Link className="button-link" href="/coaching/intake">
              Start intake
            </Link>
            <Link className="secondary-link" href="/admin/submissions">
              View admin demo
            </Link>
          </div>
        </div>
        <aside className="home-summary-card" aria-label="Coaching workflow summary">
          <span>01 Intake</span>
          <span>02 Expert panel</span>
          <span>03 Moderator plan</span>
          <span>04 Review + PDF</span>
        </aside>
      </section>

      <section className="card-grid three-column-grid">
        <article className="card stack">
          <h2>Input form</h2>
          <p>
            Capture profile, goals, availability, equipment, limitations, and orchestration mode for
            test or production routing.
          </p>
        </article>
        <article className="card stack">
          <h2>Agent workflow</h2>
          <p>
            Compress raw intake once, pass privacy-minimized context to expert reviewers, and let
            the final moderator synthesize the plan.
          </p>
        </article>
        <article className="card stack">
          <h2>Admin review</h2>
          <p>
            Use the admin pages as placeholders for triage, review states, and future protected
            repository-backed workflows.
          </p>
        </article>
      </section>
    </main>
  );
}
