const goals = [
  "Build strength",
  "Improve conditioning",
  "Lose body fat",
  "Move without pain",
  "Prepare for an event",
];

export default function CoachingIntakePage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <p className="eyebrow">Coaching intake</p>
        <h1>Tell us what you want your coaching plan to solve.</h1>
        <p>
          This v1 intake captures the essentials Mario needs before routing your request through the
          coaching agents. Submissions are not wired to persistence yet, so the form currently sends
          you to the confirmation page.
        </p>
      </section>

      <form action="/coaching/thank-you" className="card-grid" method="get">
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
          <p>
            By submitting, you confirm this information is accurate enough for a coach to review.
          </p>
          <button type="submit">Submit intake</button>
        </div>
      </form>
    </main>
  );
}
