import { CoachingIntakeForm } from "./CoachingIntakeForm";

export default function CoachingIntakePage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <p className="eyebrow">Coaching intake</p>
        <h1>Tell us what you want your coaching plan to solve.</h1>
        <p>
          This multi-step intake keeps the experience focused while capturing the goal, safety,
          training, lifestyle, nutrition, and consent details needed for coaching review and later
          AI plan generation.
        </p>
      </section>

      <CoachingIntakeForm />
    </main>
  );
}
