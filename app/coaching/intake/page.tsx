import { CoachingIntakeForm } from "./CoachingIntakeForm";

export default function CoachingIntakePage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <p className="eyebrow">Coaching intake</p>
        <h1>Tell us what you want your coaching plan to solve.</h1>
        <p>
          This intake captures the essentials Mario needs before routing your request through the
          coaching agents. Submissions are saved through the coaching API, then queued for review
          and plan generation.
        </p>
      </section>

      <CoachingIntakeForm />
    </main>
  );
}
