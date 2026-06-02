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
| 4 | `mobility_coach`        | `agents/mobilityCoach.ts`             |
| 5 | `panel_brief`           | `agents/panelBrief.ts`                |
| 6 | `training_plan_writer`  | `agents/trainingPlanWriter.ts`        |
| 7 | `nutrition_plan_writer` | `agents/nutritionPlanWriter.ts`       |

> **Async + challenge.** The reviewers (2–4) run in parallel. The two writers then run in two
> parallel waves: a **draft** (independent), then a **cross-review** where each reads the other's
> draft, challenges it, and revises its own half for one coherent plan. Each writer file therefore
> exports two prompts — `buildXxxWriterSystemPrompt` (draft) and `buildXxxChallengePrompt`
> (cross-review). The challenge step ids are `training_plan_challenge` / `nutrition_plan_challenge`.
>
> The training writer does its own fitness design and the nutrition writer its own nutrition
> analysis — the former `fitness_coach` and `nutrition_reviewer` reviewer steps were merged into
> them, so there is no separate analyst per domain. `mobility_coach` stays a separate reviewer.

Shared fragments reused across agents:

- `shared/expertSystemTemplate.ts` — the role wrapper + JSON output contract shared by the panel
  reviewers (steps 2–4), and the user message that hands them the compressed intake.
- `shared/planDuration.ts` — the phase/progression wording for 1 / 4 / 12 / 24-week plans
  (injected into the training writer) plus the per-length output-token budget.

## Conventions

- A small prompt is exported as a `const` string; a prompt that needs runtime values (intake,
  title, plan duration) is exported as a `buildXxx(...)` function.
- Provider-specific execution settings (model, temperature, max tokens) belong in `../ai/` and the
  orchestrator; workflow sequencing belongs in `../orchestration/`. Keep this folder to prompt text.
