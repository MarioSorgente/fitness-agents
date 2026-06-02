import type { Metadata } from "next";

import { CoachingIntakeForm } from "../coaching/intake/CoachingIntakeForm";

export const metadata: Metadata = {
  title: "Coaching intake",
  description: "Securely share your goals, training background, health, and lifestyle.",
};

type StandaloneIntakePageProps = {
  searchParams: Promise<{
    title?: string;
    subtitle?: string;
  }>;
};

// Public, shareable intake form for embedding on a partner website via a direct link.
// External clients only submit their data here — generation happens later in the admin area.
export default async function StandaloneIntakePage({ searchParams }: StandaloneIntakePageProps) {
  const { title, subtitle } = await searchParams;

  return (
    <main className="page-shell standalone-shell">
      <section className="hero-panel">
        <p className="eyebrow">Coaching intake</p>
        <h1>{title?.trim() || "Tell us about your goals, health, and training."}</h1>
        <p>
          {subtitle?.trim() ||
            "This secure form takes about 10 minutes. Your answers are saved privately and reviewed by your coaching team — there is nothing to download or generate on your side."}
        </p>
      </section>

      <CoachingIntakeForm mode="standalone" />
    </main>
  );
}
