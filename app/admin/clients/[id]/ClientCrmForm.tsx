"use client";

import { useActionState } from "react";

import type { ClientProfile } from "@/lib/coaching/db/coachingRepository";

import { updateClientCrmProfile, type ClientCrmFormState } from "./actions";

type ClientCrmFormProps = {
  profile: ClientProfile;
};

function dateValue(date: Date | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

const initialState: ClientCrmFormState = { ok: false, message: "" };

export function ClientCrmForm({ profile }: ClientCrmFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateClientCrmProfile.bind(null, profile.id),
    initialState,
  );

  return (
    <section className="card stack">
      <div className="section-heading">
        <h2>Editable CRM details</h2>
        <span>{profile.priority} priority</span>
      </div>
      <form action={formAction} className="stack">
        <div className="field-grid">
          <label>
            Status
            <select name="status" defaultValue={profile.status}>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            Priority
            <select name="priority" defaultValue={profile.priority}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label>
            Starting date
            <input name="startDate" type="date" defaultValue={dateValue(profile.startDate)} />
          </label>
          <label>
            Next follow-up date
            <input
              name="nextFollowUpDate"
              type="date"
              defaultValue={dateValue(profile.nextFollowUpDate)}
            />
          </label>
          <label>
            Check-in cadence
            <input
              name="checkInCadence"
              defaultValue={profile.checkInCadence ?? ""}
              placeholder="Weekly, biweekly, monthly..."
            />
          </label>
          <label>
            Current plan phase
            <input
              name="currentPlanPhase"
              defaultValue={profile.currentPlanPhase ?? ""}
              placeholder="Foundation, hypertrophy, deload..."
            />
          </label>
          <label>
            Internal tags
            <input
              name="internalTags"
              defaultValue={profile.internalTags.join(", ")}
              placeholder="Comma-separated tags"
            />
          </label>
          <label>
            Measurements summary
            <textarea
              name="measurementsSummary"
              defaultValue={profile.measurementsSummary ?? ""}
              placeholder="Weight, waist, photos, key progress notes..."
              rows={4}
            />
          </label>
          <label>
            Coach notes
            <textarea
              name="coachNotes"
              defaultValue={profile.coachNotes ?? ""}
              placeholder="Private coaching notes and follow-up context..."
              rows={6}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save CRM details"}
          </button>
          {state.message ? (
            <p className={state.ok ? "success-text" : "error-text"} aria-live="polite">
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
