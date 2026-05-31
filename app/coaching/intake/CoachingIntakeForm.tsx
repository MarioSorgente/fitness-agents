"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const goals = [
  "Build strength",
  "Improve conditioning",
  "Lose body fat",
  "Move without pain",
  "Prepare for an event",
];

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

function getCheckedValues(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function getStringValue(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? "").trim();

  return value || undefined;
}

export function CoachingIntakeForm() {
  const router = useRouter();
  const [submissionState, setSubmissionState] = useState<SubmissionState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionState({ status: "submitting" });

    const formData = new FormData(event.currentTarget);
    const email = getStringValue(formData, "email");
    const name = getStringValue(formData, "name");
    const selectedGoals = getCheckedValues(formData, "goals");
    const daysPerWeek = getStringValue(formData, "daysPerWeek");
    const equipment = getStringValue(formData, "equipment");
    const limitations = getStringValue(formData, "limitations");
    const successCriteria = getStringValue(formData, "successCriteria");

    try {
      const response = await fetch("/api/coaching/submit-intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: email ?? "anonymous-intake",
          payload: {
            name,
            email,
            experience: getStringValue(formData, "experience"),
            goals: selectedGoals,
            successCriteria,
            daysPerWeek,
            equipment,
            limitations,
            orchestrationMode: getStringValue(formData, "orchestrationMode"),
            clientProfile: {
              name,
              email,
              trainingExperience: getStringValue(formData, "experience"),
              goals: selectedGoals,
              availability: daysPerWeek ? `${daysPerWeek} days per week` : undefined,
              equipment: equipment ? [equipment] : [],
              constraints: limitations ? [limitations] : [],
              safetySignals: limitations ? [limitations] : [],
              nutritionSignals: [],
              missingInformation: [],
              coachSummary: successCriteria,
            },
          },
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        data?: { submission?: { id?: string } };
        error?: { message?: string };
      } | null;

      if (!response.ok) {
        throw new Error(result?.error?.message ?? "Unable to submit intake. Please try again.");
      }

      const submissionId = result?.data?.submission?.id;
      const query = submissionId ? `?submissionId=${encodeURIComponent(submissionId)}` : "";

      router.push(`/coaching/thank-you${query}`);
    } catch (error) {
      setSubmissionState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Unable to submit intake. Please try again.",
      });
    }
  }

  return (
    <form className="card-grid" onSubmit={handleSubmit}>
      <section className="card stack">
        <h2>Profile</h2>
        <label>
          Name
          <input name="name" placeholder="First and last name" required type="text" />
        </label>
        <label>
          Email
          <input name="email" placeholder="you@example.com" required type="email" />
        </label>
        <label>
          Training experience
          <select name="experience" required defaultValue="">
            <option disabled value="">
              Choose one
            </option>
            <option value="new">New to structured training</option>
            <option value="intermediate">Training consistently</option>
            <option value="advanced">Advanced or competitive</option>
            <option value="returning">Returning after a break</option>
          </select>
        </label>
      </section>

      <section className="card stack">
        <h2>Goals</h2>
        <fieldset>
          <legend>Primary goal areas</legend>
          <div className="checkbox-list">
            {goals.map((goal) => (
              <label key={goal} className="checkbox-row">
                <input name="goals" type="checkbox" value={goal} />
                <span>{goal}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          What would make the next 12 weeks successful?
          <textarea
            name="successCriteria"
            placeholder="Share outcomes, constraints, habits, or milestones."
            required
            rows={5}
          />
        </label>
      </section>

      <section className="card stack">
        <h2>AI orchestration mode</h2>
        <fieldset aria-describedby="orchestration-mode-note">
          <legend>Choose testing or production routing</legend>
          <div className="radio-list">
            <label className="radio-row">
              <input defaultChecked name="orchestrationMode" type="radio" value="test" />
              <span>Test</span>
            </label>
            <label className="radio-row">
              <input name="orchestrationMode" type="radio" value="production" />
              <span>Production</span>
            </label>
          </div>
          <p className="tooltip-note" id="orchestration-mode-note" role="note">
            Test mode runs every orchestration step on the cheapest fast route: Kimi moonshot-v1-8k,
            then OpenAI gpt-4.1-nano, then Anthropic claude-haiku-4-5 if fallbacks are needed.
            Production mode keeps cheap/heavy steps on that fast route and uses Anthropic
            claude-opus-4-7 for the final moderator, with OpenAI gpt-4.1-mini then Kimi
            moonshot-v1-32k as fallbacks.
          </p>
        </fieldset>
      </section>

      <section className="card stack">
        <h2>Availability and constraints</h2>
        <label>
          Days available per week
          <input min="1" max="7" name="daysPerWeek" required type="number" />
        </label>
        <label>
          Equipment access
          <textarea
            name="equipment"
            placeholder="Gym, home dumbbells, bands, bike, no equipment, etc."
            rows={4}
          />
        </label>
        <label>
          Injuries, limitations, or medical considerations
          <textarea
            name="limitations"
            placeholder="Include anything a coach should account for."
            rows={4}
          />
        </label>
      </section>

      <div className="form-actions">
        <div className="stack form-status-copy">
          <p>
            By submitting, you confirm this information is accurate enough for a coach to review.
          </p>
          {submissionState.status === "error" ? (
            <p className="error-text" role="alert">
              {submissionState.message}
            </p>
          ) : null}
        </div>
        <button disabled={submissionState.status === "submitting"} type="submit">
          {submissionState.status === "submitting" ? "Submitting…" : "Submit intake"}
        </button>
      </div>
    </form>
  );
}
