import type { CompactClientProfile } from "@/lib/coaching/schemas/intakeSchema";

type IntakeSnapshotProps = {
  payload: Record<string, unknown>;
  title?: string;
  includeContact?: boolean;
};

export function field(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function humanize(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  const spaced = value.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function joinList(value: unknown): string {
  if (!Array.isArray(value)) return "—";
  const items = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return items.length > 0 ? items.map(humanize).join(", ") : "—";
}

function compactNotes(...values: Array<string | undefined>): string {
  const notes = values.map((value) => value?.trim()).filter(Boolean);
  return notes.length > 0 ? notes.join("; ") : "—";
}

export function IntakeSnapshot({
  payload,
  title = "Client snapshot",
  includeContact = false,
}: IntakeSnapshotProps) {
  const profile = (payload.clientProfile as CompactClientProfile | undefined) ?? undefined;
  const availability =
    profile?.availability ||
    compactNotes(
      field(payload, "availableDaysPerWeek")
        ? `${field(payload, "availableDaysPerWeek")} days/week`
        : undefined,
      field(payload, "sessionDurationMinutes")
        ? `${field(payload, "sessionDurationMinutes")} min/session`
        : undefined,
      joinList(payload.preferredTrainingDays) !== "—"
        ? joinList(payload.preferredTrainingDays)
        : undefined,
    );
  const nutritionConstraints = compactNotes(
    field(payload, "dietaryRestrictions"),
    field(payload, "foodAllergies"),
    field(payload, "foodIntolerances"),
    field(payload, "foodsAvoided"),
  );
  const medicalNotes = compactNotes(
    field(payload, "knownDiagnoses"),
    field(payload, "otherDiagnosedConditions"),
    field(payload, "physicalLimitationsAggravatedByExercise"),
    field(payload, "movementsExercisesPositionsAvoided"),
    field(payload, "exercisesThatCausePain"),
  );

  return (
    <section className="card stack">
      <h2>{title}</h2>
      <dl className="detail-list">
        {includeContact ? (
          <>
            <div>
              <dt>Name</dt>
              <dd>{field(payload, "fullName") || profile?.name || "—"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{field(payload, "email") || "—"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{field(payload, "phoneNumber") || "—"}</dd>
            </div>
          </>
        ) : null}
        <div>
          <dt>Main goal</dt>
          <dd>{humanize(field(payload, "mainGoal"))}</dd>
        </div>
        <div>
          <dt>Goal detail</dt>
          <dd>{field(payload, "specificGoalDescription") || "—"}</dd>
        </div>
        <div>
          <dt>Training level</dt>
          <dd>{humanize(field(payload, "trainingLevel"))}</dd>
        </div>
        <div>
          <dt>Safety status</dt>
          <dd>{humanize(field(payload, "safetyStatus"))}</dd>
        </div>
        <div>
          <dt>Equipment</dt>
          <dd>{joinList(payload.equipmentAvailable)}</dd>
        </div>
        <div>
          <dt>Availability</dt>
          <dd>{availability}</dd>
        </div>
        <div>
          <dt>Nutrition constraints</dt>
          <dd>{nutritionConstraints}</dd>
        </div>
        <div>
          <dt>Injury/medical notes</dt>
          <dd>{medicalNotes}</dd>
        </div>
      </dl>
    </section>
  );
}
