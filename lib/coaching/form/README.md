# Coaching Intake Form

The client intake form is intentionally metadata-driven so question definitions are not scattered through React components.

## Where to edit form fields

Edit `lib/coaching/form/intakeFields.ts` for field names, labels, field types, helper text, placeholders, required flags, conditional required metadata, repeatable groups, and nested group structures.

The exported field groups mirror the intake experience:

- `aboutYouFields`
- `goalFields`
- `trainingBackgroundFields`
- `healthSafetyFields`
- `medicalHistoryFields`
- `painInjuryFields`
- `lifestyleMindsetFields`
- `nutritionFields`
- `foodLogFields`
- `privacyTermsFields`

The React form at `app/coaching/intake/CoachingIntakeForm.tsx` renders these definitions and should not be used as the source of truth for questions.

## Where to edit options

Edit `lib/coaching/form/intakeOptions.ts` for select, multi-select, Yes/No, pain area, food log, nutrition, lifestyle, and training option lists.

If an option list changes, update it in this file and reference it from `intakeFields.ts`.

## Where validation lives

Submission validation lives in `lib/coaching/schemas/intakeSchema.ts` as `coachingIntakeSchema`.

This Zod schema validates the saved `CoachingIntake` payload, including:

- required text fields such as `fullName`, `email`, `mainGoal`, and `specificGoalDescription`
- numeric ranges such as age, confidence, and pain severity
- required PAR-Q answers
- privacy and terms checkboxes that must be accepted
- conditional validation for recent weight change details
- the derived `safetyStatus` saved with each intake

## Where required fields are defined

UI required indicators live beside each field in `lib/coaching/form/intakeFields.ts` via `required: true` or `requiredWhen`.

Server-side required validation lives in `lib/coaching/schemas/intakeSchema.ts`; keep the schema aligned with the UI metadata so API validation and the form experience match.

## How to add a new section

1. Add any new option lists to `intakeOptions.ts`.
2. Add the new fields or field group to `intakeFields.ts`.
3. Add a section entry to `intakeSections.ts` with an `id`, `title`, `description`, and `fields` array.
4. Add matching Zod properties to `lib/coaching/schemas/intakeSchema.ts`.
5. If the field should affect red-flag handling, update `deriveSafetyStatus` in `intakeSchema.ts`.
6. Confirm the intake page renders the new section and API submission still validates.

## How this maps into the `CoachingIntake` schema

The UI stores answers in one object using the exact field names from `intakeFields.ts`. On submit, `CoachingIntakeForm.tsx` sends that object to `/api/coaching/submit-intake` as `payload`.

The API validates `payload` with `coachingIntakeSchema`. The schema preserves the full intake and also derives legacy/agent-friendly fields:

- `name` from `fullName`
- `goals` from `mainGoal` plus `secondaryGoals`
- `experience` from `trainingLevel`
- `daysPerWeek` from `availableDaysPerWeek`
- `equipment` from `equipmentAvailable`
- `limitations` from pain, avoided movements, and known diagnoses
- `clientProfile.primaryGoal` and `clientProfile.goalDescription` for the AI panel
- `clientProfile.safetyStatus` and top-level `safetyStatus`

The client goal is treated as a first-class AI planning field: `mainGoal` is required, `specificGoalDescription` is required, and both are copied into `clientProfile` for downstream agents.

## Safety and red-flag logic

Safety/red-flag logic lives in `deriveSafetyStatus` in `lib/coaching/schemas/intakeSchema.ts`.

The function returns one of:

- `clear`
- `caution`
- `medical_clearance_recommended`

Red flags never block submission. They are saved with the intake so admin review and later AI plan generation can surface the appropriate safety status.
