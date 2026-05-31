"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { type IntakeField } from "@/lib/coaching/form/intakeFields";
import { intakeIntroCopy, intakeSections } from "@/lib/coaching/form/intakeSections";
import { deriveSafetyStatus, type CoachingIntakeInput } from "@/lib/coaching/schemas/intakeSchema";

type IntakeFormData = Record<string, unknown>;
type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultValue(field: IntakeField): unknown {
  if (field.type === "multi-select" || field.type === "repeatable_group") {
    return [];
  }
  if (field.type === "field_group") {
    return Object.fromEntries(
      (field.fields ?? []).map((child) => [child.name, getDefaultValue(child)]),
    );
  }
  if (field.type === "checkbox") {
    return false;
  }
  if (field.type === "yes_no_with_explanation") {
    return { answer: "", explanation: "" };
  }
  return "";
}

function createInitialFormData(): IntakeFormData {
  const data: IntakeFormData = {
    orchestrationMode: "test",
    dateSigned: todayIsoDate(),
  };

  for (const section of intakeSections) {
    for (const field of section.fields) {
      data[field.name] = field.name === "dateSigned" ? todayIsoDate() : getDefaultValue(field);
    }
  }

  return data;
}

function getValueAtPath(source: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function setValueAtPath(source: IntakeFormData, path: string[], value: unknown): IntakeFormData {
  const next = structuredClone(source) as IntakeFormData;
  let cursor: Record<string, unknown> = next;

  path.slice(0, -1).forEach((key, index) => {
    const existing = cursor[key];
    const nextKey = path[index + 1];
    const fallback = Number.isInteger(Number(nextKey)) ? [] : {};
    cursor[key] = existing && typeof existing === "object" ? existing : fallback;
    cursor = cursor[key] as Record<string, unknown>;
  });

  cursor[path[path.length - 1]] = value;
  return next;
}

function isFilled(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === "object" && "answer" in value) {
    return isFilled((value as { answer?: unknown }).answer);
  }
  return false;
}

function cleanValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanValue).filter((entry) => {
      if (entry === undefined) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (entry && typeof entry === "object") return Object.keys(entry).length > 0;
      return true;
    });
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, cleanValue(entry)] as const)
      .filter(([, entry]) => entry !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  if (value === "") {
    return undefined;
  }

  return value;
}

function buildPayload(formData: IntakeFormData): CoachingIntakeInput {
  const cleaned = cleanValue(formData) as Record<string, unknown>;
  const safetyStatus = deriveSafetyStatus(cleaned);
  const fullName = String(cleaned.fullName ?? "");
  const email = String(cleaned.email ?? "");
  const mainGoal = String(cleaned.mainGoal ?? "");
  const secondaryGoals = Array.isArray(cleaned.secondaryGoals) ? cleaned.secondaryGoals : [];
  const equipmentAvailable = Array.isArray(cleaned.equipmentAvailable)
    ? cleaned.equipmentAvailable
    : [];

  return {
    ...cleaned,
    name: fullName,
    goals: [mainGoal, ...secondaryGoals].filter(Boolean),
    clientProfile: {
      name: fullName,
      email,
      age: typeof cleaned.age === "number" ? cleaned.age : Number(cleaned.age),
      trainingExperience: String(cleaned.trainingLevel ?? ""),
      goals: [mainGoal, ...secondaryGoals].filter(
        (goal): goal is string => typeof goal === "string",
      ),
      primaryGoal: mainGoal,
      goalDescription: String(cleaned.specificGoalDescription ?? ""),
      availability: `${cleaned.availableDaysPerWeek ?? ""} days per week, ${cleaned.sessionDurationMinutes ?? ""} minute sessions`,
      equipment: equipmentAvailable.filter((item): item is string => typeof item === "string"),
      constraints: [
        cleaned.exercisesThatCausePain,
        cleaned.movementsExercisesPositionsAvoided,
        cleaned.knownDiagnoses,
      ].filter((item): item is string => typeof item === "string" && item.length > 0),
      safetySignals: safetyStatus === "clear" ? [] : [`Safety status: ${safetyStatus}`],
      safetyStatus,
      nutritionSignals: [cleaned.currentNutritionBehavior, cleaned.dietaryRestrictions].filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      ),
      missingInformation: [],
      coachSummary: String(cleaned.desiredOutcome ?? cleaned.specificGoalDescription ?? ""),
    },
    safetyStatus,
  } as CoachingIntakeInput;
}

function FieldLabel({ field }: { field: IntakeField }) {
  return (
    <span>
      {field.label} {field.required ? <span className="required-mark">*</span> : null}
    </span>
  );
}

function FieldHelp({ field }: { field: IntakeField }) {
  return field.helperText ? <small className="field-help">{field.helperText}</small> : null;
}

type FieldRendererProps = {
  field: IntakeField;
  path: string[];
  formData: IntakeFormData;
  setFormData: (updater: (current: IntakeFormData) => IntakeFormData) => void;
  nesting?: number;
};

function FieldRenderer({ field, path, formData, setFormData, nesting = 0 }: FieldRendererProps) {
  const value = getValueAtPath(formData, path);
  const updateValue = (nextValue: unknown) => {
    setFormData((current) => setValueAtPath(current, path, nextValue));
  };
  const inputId = path.join("-");

  if (field.type === "field_group") {
    return (
      <fieldset className="sub-fieldset">
        <legend>{field.label}</legend>
        <div className="nested-grid">
          {(field.fields ?? []).map((child) => (
            <FieldRenderer
              key={child.name}
              field={child}
              formData={formData}
              nesting={nesting + 1}
              path={[...path, child.name]}
              setFormData={setFormData}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === "repeatable_group") {
    const items = Array.isArray(value) ? value : [];
    const canAdd = !field.maxItems || items.length < field.maxItems;
    const addItem = () => {
      updateValue([
        ...items,
        Object.fromEntries(
          (field.fields ?? []).map((child) => [child.name, getDefaultValue(child)]),
        ),
      ]);
    };
    const removeItem = (index: number) => {
      updateValue(items.filter((_, itemIndex) => itemIndex !== index));
    };

    return (
      <section className="repeatable-card">
        <div className="repeatable-heading">
          <div>
            <h3>{field.label}</h3>
            <FieldHelp field={field} />
          </div>
          {canAdd ? (
            <button className="secondary-button" onClick={addItem} type="button">
              Add
            </button>
          ) : null}
        </div>
        {items.length === 0 ? <p className="muted-copy">No entries added yet.</p> : null}
        {items.map((_, index) => (
          <div className="repeatable-item" key={`${field.name}-${index}`}>
            <div className="repeatable-item-heading">
              <strong>
                {field.label} {index + 1}
              </strong>
              <button className="text-button" onClick={() => removeItem(index)} type="button">
                Remove
              </button>
            </div>
            <div className="nested-grid">
              {(field.fields ?? []).map((child) => (
                <FieldRenderer
                  key={child.name}
                  field={child}
                  formData={formData}
                  nesting={nesting + 1}
                  path={[...path, String(index), child.name]}
                  setFormData={setFormData}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="checkbox-row consent-row" htmlFor={inputId}>
        <input
          checked={Boolean(value)}
          id={inputId}
          onChange={(event) => updateValue(event.target.checked)}
          type="checkbox"
        />
        <FieldLabel field={field} />
      </label>
    );
  }

  if (field.type === "multi-select") {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <fieldset className="sub-fieldset">
        <legend>
          <FieldLabel field={field} />
        </legend>
        <div className="checkbox-list compact-options">
          {(field.options ?? []).map((option) => (
            <label className="checkbox-row" key={option.value}>
              <input
                checked={selectedValues.includes(option.value)}
                onChange={(event) => {
                  updateValue(
                    event.target.checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((item) => item !== option.value),
                  );
                }}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <FieldHelp field={field} />
      </fieldset>
    );
  }

  if (field.type === "yes_no" || field.type === "yes_no_with_explanation") {
    const answer =
      field.type === "yes_no_with_explanation"
        ? ((value as { answer?: string } | undefined)?.answer ?? "")
        : String(value ?? "");
    const explanation =
      field.type === "yes_no_with_explanation"
        ? ((value as { explanation?: string } | undefined)?.explanation ?? "")
        : "";
    return (
      <fieldset className="sub-fieldset">
        <legend>
          <FieldLabel field={field} />
        </legend>
        <div className="radio-list inline-options">
          {(field.options ?? []).map((option) => (
            <label className="radio-row" key={option.value}>
              <input
                checked={answer === option.value}
                onChange={() =>
                  field.type === "yes_no_with_explanation"
                    ? updateValue({ answer: option.value, explanation })
                    : updateValue(option.value)
                }
                type="radio"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {field.type === "yes_no_with_explanation" && answer === "yes" ? (
          <label className="nested-explanation">
            Optional context
            <textarea
              onChange={(event) => updateValue({ answer, explanation: event.target.value })}
              placeholder="Share anything your coach should know."
              rows={3}
              value={explanation}
            />
          </label>
        ) : null}
        <FieldHelp field={field} />
      </fieldset>
    );
  }

  if (field.type === "textarea") {
    return (
      <label htmlFor={inputId}>
        <FieldLabel field={field} />
        <textarea
          id={inputId}
          maxLength={10000}
          onChange={(event) => updateValue(event.target.value)}
          placeholder={field.placeholder}
          rows={4}
          value={String(value ?? "")}
        />
        <FieldHelp field={field} />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label htmlFor={inputId}>
        <FieldLabel field={field} />
        <select
          id={inputId}
          onChange={(event) => updateValue(event.target.value)}
          value={String(value ?? "")}
        >
          <option value="">Choose one</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldHelp field={field} />
      </label>
    );
  }

  return (
    <label htmlFor={inputId}>
      <FieldLabel field={field} />
      <input
        id={inputId}
        max={field.max}
        min={field.min}
        onChange={(event) =>
          updateValue(field.type === "number" ? event.target.value : event.target.value)
        }
        placeholder={field.placeholder}
        type={field.type}
        value={String(value ?? "")}
      />
      <FieldHelp field={field} />
    </label>
  );
}

function collectRequiredErrors(fields: IntakeField[], data: IntakeFormData): string[] {
  const errors: string[] = [];

  for (const field of fields) {
    if (field.required && !isFilled(data[field.name])) {
      errors.push(field.label);
    }
    if (field.requiredWhen) {
      const watched = data[field.requiredWhen.field];
      const watchedValue =
        typeof watched === "object" && watched !== null && "answer" in watched
          ? (watched as { answer?: string }).answer
          : watched;
      if (watchedValue === field.requiredWhen.equals && !isFilled(data[field.name])) {
        errors.push(field.label);
      }
    }
  }

  return errors;
}

export function CoachingIntakeForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<IntakeFormData>(() => createInitialFormData());
  const [submissionState, setSubmissionState] = useState<SubmissionState>({ status: "idle" });
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const currentSection = intakeSections[currentStep];
  const progress = useMemo(
    () => Math.round(((currentStep + 1) / intakeSections.length) * 100),
    [currentStep],
  );

  function goToNextStep() {
    const errors = collectRequiredErrors(currentSection.fields, formData);
    if (errors.length > 0) {
      setStepErrors(errors);
      return;
    }
    setStepErrors([]);
    setCurrentStep((step) => Math.min(step + 1, intakeSections.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    const missingRequiredFields = intakeSections.flatMap((section) =>
      collectRequiredErrors(section.fields, formData),
    );
    if (missingRequiredFields.length > 0) {
      setStepErrors(missingRequiredFields);
      setSubmissionState({
        status: "error",
        message: "Please complete all required fields before submitting.",
      });
      return;
    }

    setSubmissionState({ status: "submitting" });
    const payload = buildPayload(formData);

    try {
      const response = await fetch("/api/coaching/submit-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: payload.email ?? "anonymous-intake",
          payload,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        data?: { submission?: { id?: string } };
        error?: { message?: string; issues?: Array<{ path: string; message: string }> };
      } | null;

      if (!response.ok) {
        const issueSummary = result?.error?.issues
          ?.map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ");
        throw new Error(
          issueSummary || result?.error?.message || "Unable to submit intake. Please try again.",
        );
      }

      const submissionId = result?.data?.submission?.id;
      router.push(
        `/coaching/thank-you${submissionId ? `?submissionId=${encodeURIComponent(submissionId)}` : ""}`,
      );
    } catch (error) {
      setSubmissionState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Unable to submit intake. Please try again.",
      });
    }
  }

  return (
    <section className="intake-shell">
      <div className="intake-progress card">
        <div>
          <p className="eyebrow">Client intake</p>
          <h2>{currentSection.title}</h2>
          <p>{intakeIntroCopy}</p>
        </div>
        <div className="progress-meta">
          <span>
            Step {currentStep + 1} of {intakeSections.length}
          </span>
          <strong>{progress}% complete</strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form className="card stack intake-card" onSubmit={(event) => event.preventDefault()}>
        <div className="section-heading intake-section-heading">
          <div>
            <p className="eyebrow">{currentSection.eyebrow}</p>
            <h2>{currentSection.title}</h2>
            <p>{currentSection.description}</p>
          </div>
          {currentSection.optional ? <span>Optional</span> : null}
        </div>

        {currentSection.id === "food-log" ? (
          <details className="optional-panel" open={false}>
            <summary>Add the optional food log</summary>
            <div className="field-grid">
              {currentSection.fields.map((field) => (
                <FieldRenderer
                  key={field.name}
                  field={field}
                  formData={formData}
                  path={[field.name]}
                  setFormData={setFormData}
                />
              ))}
            </div>
          </details>
        ) : (
          <div className="field-grid">
            {currentSection.fields.map((field) => (
              <FieldRenderer
                key={field.name}
                field={field}
                formData={formData}
                path={[field.name]}
                setFormData={setFormData}
              />
            ))}
          </div>
        )}

        {stepErrors.length > 0 ? (
          <div className="warning-panel compact-warning" role="alert">
            <strong>Please complete:</strong> {stepErrors.slice(0, 8).join(", ")}
            {stepErrors.length > 8 ? `, and ${stepErrors.length - 8} more required fields` : ""}.
          </div>
        ) : null}

        {submissionState.status === "error" ? (
          <p className="error-text">{submissionState.message}</p>
        ) : null}

        <div className="form-actions">
          <button
            className="secondary-button"
            disabled={currentStep === 0 || submissionState.status === "submitting"}
            onClick={() => {
              setStepErrors([]);
              setCurrentStep((step) => Math.max(0, step - 1));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            type="button"
          >
            Previous
          </button>
          {currentStep < intakeSections.length - 1 ? (
            <button onClick={goToNextStep} type="button">
              Next section
            </button>
          ) : (
            <button
              disabled={submissionState.status === "submitting"}
              onClick={handleSubmit}
              type="button"
            >
              {submissionState.status === "submitting" ? "Submitting…" : "Submit intake"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
