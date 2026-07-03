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
            Current weight
            <input name="currentWeight" defaultValue={profile.currentWeight ?? ""} />
          </label>
          <label>
            Target weight
            <input name="targetWeight" defaultValue={profile.targetWeight ?? ""} />
          </label>
          <label>
            Height
            <input name="height" defaultValue={profile.height ?? ""} />
          </label>
          <label>
            Training days per week
            <input
              name="trainingDaysPerWeek"
              type="number"
              min="1"
              max="7"
              defaultValue={profile.trainingDaysPerWeek ?? ""}
            />
          </label>
          <label>
            Preferred training days
            <input
              name="preferredTrainingDays"
              defaultValue={(profile.preferredTrainingDays ?? []).join(", ")}
              placeholder="Monday, Wednesday, Friday"
            />
          </label>
          <label>
            Session length minutes
            <input name="sessionLengthMinutes" defaultValue={profile.sessionLengthMinutes ?? ""} />
          </label>
          <label>
            Last check-in date
            <input
              name="lastCheckInDate"
              type="date"
              defaultValue={dateValue(profile.lastCheckInDate)}
            />
          </label>
          <label>
            Next check-in date
            <input
              name="nextCheckInDate"
              type="date"
              defaultValue={dateValue(profile.nextCheckInDate)}
            />
          </label>
          <label>
            Last plan update date
            <input
              name="lastPlanUpdateDate"
              type="date"
              defaultValue={dateValue(profile.lastPlanUpdateDate)}
            />
          </label>
          <label>
            Renewal date
            <input name="renewalDate" type="date" defaultValue={dateValue(profile.renewalDate)} />
          </label>
          <label>
            Payment status
            <input name="paymentStatus" defaultValue={profile.paymentStatus ?? ""} />
          </label>
          <label>
            Nutrition focus
            <textarea name="nutritionFocus" defaultValue={profile.nutritionFocus ?? ""} rows={3} />
          </label>
          <label>
            Sleep focus
            <textarea name="sleepFocus" defaultValue={profile.sleepFocus ?? ""} rows={3} />
          </label>
          <label>
            Stress level
            <textarea name="stressLevel" defaultValue={profile.stressLevel ?? ""} rows={3} />
          </label>
          <label>
            Injury flags
            <textarea name="injuryFlags" defaultValue={profile.injuryFlags ?? ""} rows={4} />
          </label>
          <label>
            Medication flags
            <textarea
              name="medicationFlags"
              defaultValue={profile.medicationFlags ?? ""}
              rows={4}
            />
          </label>
          <label>
            Motivation style
            <textarea
              name="motivationStyle"
              defaultValue={profile.motivationStyle ?? ""}
              rows={3}
            />
          </label>
          <label>
            Accountability preference
            <textarea
              name="accountabilityPreference"
              defaultValue={profile.accountabilityPreference ?? ""}
              rows={3}
            />
          </label>
          <label>
            Measurement notes
            <textarea
              name="measurementNotes"
              defaultValue={profile.measurementNotes ?? ""}
              rows={4}
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
