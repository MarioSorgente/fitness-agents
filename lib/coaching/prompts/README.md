# Coaching Prompts

Every agent prompt lives here, one file per agent — edit these to change what the agents say. The
orchestrator (`../orchestration/generateCoachingPlan.ts`) only sequences the steps and imports the
wording from this folder. `index.ts` is the registry / table of contents.

## Where each prompt is

Pipeline order, and the file to edit:

| # | Step (`stepId`)         | File                                  |
| - | ----------------------- | ------------------------------------- |
| 1 | `intake_compression`    | `agents/intakeCompression.ts`         |
| 2 | `medical_safety_screener` | `agents/medicalSafetyScreener.ts`   |
| 3 | `physio_reviewer`       | `agents/physioReviewer.ts`            |
| 4 | `fitness_coach`         | `agents/fitnessCoach.ts`              |
| 5 | `mobility_coach`        | `agents/mobilityCoach.ts`             |
| 6 | `nutrition_reviewer`    | `agents/nutritionReviewer.ts`         |
| 7 | `panel_brief`           | `agents/panelBrief.ts`                |
| 8 | `training_plan_writer`  | `agents/trainingPlanWriter.ts`        |
| 9 | `nutrition_plan_writer` | `agents/nutritionPlanWriter.ts`       |

Shared fragments reused across agents:

- `shared/expertSystemTemplate.ts` — the role wrapper + JSON output contract shared by steps 2–6,
  and the user message that hands them the compressed intake.
- `shared/planDuration.ts` — the phase/progression wording for 1 / 4 / 12 / 24-week plans
  (injected into the training writer) plus the per-length output-token budget.

## Conventions

- A small prompt is exported as a `const` string; a prompt that needs runtime values (intake,
  title, plan duration) is exported as a `buildXxx(...)` function.
- Provider-specific execution settings (model, temperature, max tokens) belong in `../ai/` and the
  orchestrator; workflow sequencing belongs in `../orchestration/`. Keep this folder to prompt text.
