import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intake received",
  description: "Your coaching intake has been received.",
};

type CoachingSubmittedPageProps = {
  searchParams: Promise<{
    ref?: string;
  }>;
};

// Lightweight, reassuring confirmation for external submitters. No agents, no PDF,
// no download — generation is an admin-only action.
export default async function CoachingSubmittedPage({ searchParams }: CoachingSubmittedPageProps) {
  const { ref } = await searchParams;

  return (
    <main className="page-shell narrow-shell">
      <section className="hero-panel stack">
        <p className="eyebrow">Intake received</p>
        <h1>Thank you — your intake has been received.</h1>
        <p>
          Your answers were saved securely and shared with your coaching team. There is nothing
          else you need to do right now.
        </p>
        {ref ? <p className="submission-reference">Reference: {ref}</p> : null}
      </section>

      <section className="card stack">
        <h2>What happens next</h2>
        <ul className="next-steps">
          <li>Your coach reviews your goals, health and safety answers, and training context.</li>
          <li>They prepare a personalized plan tailored to your availability and equipment.</li>
          <li>You will hear back with the next steps — keep an eye on your inbox.</li>
        </ul>
        <p className="muted-copy">
          If any of your health details change before you hear back, let your coach know so the plan
          stays safe and accurate.
        </p>
      </section>
    </main>
  );
}
