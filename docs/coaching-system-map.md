# Coaching System Map

Use this map when you need to change the coaching product without rediscovering the whole codebase.
The short rule: shared contracts live in `lib/coaching/schemas/`, user-facing screens live in `app/`, and coaching internals live under `lib/coaching/`.

## Intake fields and input form

Edit intake data in three places when adding, renaming, or removing a field:

1. **Schema contract:** `lib/coaching/schemas/intakeSchema.ts` validates the payload accepted by `/api/coaching/submit-intake` and consumed by plan generation.
2. **Form UI:** `app/coaching/intake/CoachingIntakeForm.tsx` renders the browser form, collects `FormData`, maps checkbox and text answers into the API payload, and sends the submission to `/api/coaching/submit-intake`.
3. **Form page shell:** `app/coaching/intake/page.tsx` owns the page hero copy and imports the client form component.

`lib/coaching/form/` is reserved for future reusable field metadata, labels, grouping, defaults, and form-to-schema mapping helpers. Move hard-coded form definitions there once multiple screens or clients need to reuse them.

## Product UI pages

- `app/page.tsx` is the landing page and primary navigation into the intake and admin demo flows.
- `app/coaching/intake/page.tsx` and `app/coaching/intake/CoachingIntakeForm.tsx` are the intake experience.
- `app/coaching/thank-you/page.tsx` confirms successful submission and displays the returned submission reference when present.
- `app/admin/submissions/page.tsx` and `app/admin/submissions/[id]/page.tsx` are placeholder admin review screens.
- `app/globals.css` contains the shared app styling for page shells, cards, forms, admin tables, buttons, warnings, and home-page layout.

## Agent prompts

The current v1 prompt strings are inline in `lib/coaching/orchestration/generateCoachingPlan.ts`:

- `EXPERT_STEPS` defines the specialist reviewer IDs, titles, and role instructions.
- The intake compression, panel brief, and final moderator system messages are built inside `generateCoachingPlan`.

The intended long-term home for prompt text is `lib/coaching/prompts/`:

- Put reusable voice, formatting, safety, and data-handling fragments in `lib/coaching/prompts/shared/`.
- Put one-agent-only role prompts in `lib/coaching/prompts/agents/`.
- Keep provider-specific request settings in `lib/coaching/ai/` and workflow sequencing in `lib/coaching/orchestration/`.

## Shared safety rules

Safety rules currently appear in the orchestration prompts and expert instructions in `lib/coaching/orchestration/generateCoachingPlan.ts`, especially the medical safety screener, physio reviewer, nutrition reviewer, panel brief, and final moderator instructions. When a safety rule should apply broadly, move it into a reusable module under `lib/coaching/prompts/shared/` and compose it into each relevant step.

Safety-sensitive data fields are validated by `lib/coaching/schemas/intakeSchema.ts` through `limitations`, `clientProfile.constraints`, and `clientProfile.safetySignals`. Final plan and agent-output storage contracts live in `lib/coaching/schemas/coachingPlanSchema.ts`.

## Goal logic

Goal inputs are gathered in `app/coaching/intake/CoachingIntakeForm.tsx` and validated by `coachingIntakeSchema` in `lib/coaching/schemas/intakeSchema.ts`. The orchestration does not yet have a separate goal-router module; goal interpretation is handled by:

- intake compression in `lib/coaching/orchestration/generateCoachingPlan.ts`, which preserves goals, constraints, schedule, equipment, and missing information;
- expert reviewers in the same file, especially the fitness coach and mobility coach;
- the final moderator, which synthesizes the structured plan.

If goal-specific branching is needed, add explicit logic in `lib/coaching/orchestration/` and keep any new goal types or output fields reflected in `lib/coaching/schemas/`.

## AI provider routing

AI routing lives in `lib/coaching/ai/provider.ts`.

`AI_PROVIDER` is a premium synthesis preference, not a global provider lock. In production mode, cheaper/high-volume work stays on fast models first, then the two plan writers (`training_plan_writer`, `nutrition_plan_writer`) use the preferred main-model tier first.

- `AI_PROVIDER=anthropic` means the plan writers prefer Anthropic Opus first.
- Cheap and high-volume steps (`intake_compression`, expert reviewers, and `panel_brief`) try Kimi fast, then OpenAI fast, then Anthropic fast.
- The plan writers' production fallback order is the preferred `AI_PROVIDER` first, then the remaining main providers in the default order Anthropic, OpenAI, Kimi.
- In `test` (Draft) mode the writers stay on the fast tier but use the Anthropic → OpenAI → Kimi order, because Kimi's 8k context truncates a long plan.

| Task tier                | Steps                                             | Production fallback order                                                                        |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Fast / cheap panel       | Intake compression, expert reviewers, panel brief | Kimi fast → OpenAI fast → Anthropic fast                                                         |
| Main / premium synthesis | Training plan writer, nutrition plan writer       | Preferred `AI_PROVIDER` main model → remaining main providers in Anthropic → OpenAI → Kimi order |

Model names can be overridden with `KIMI_MODEL_FAST`, `OPENAI_MODEL_FAST`, `ANTHROPIC_MODEL_FAST`, `ANTHROPIC_MODEL_MAIN`, `OPENAI_MODEL_MAIN`, and `KIMI_MODEL_MAIN` without changing tier-level fallback order.

Provider adapters live in:

- `lib/coaching/ai/kimiProvider.ts`
- `lib/coaching/ai/openaiProvider.ts`
- `lib/coaching/ai/anthropicProvider.ts`

## Orchestration flow

The main orchestration entry point is `generateCoachingPlan` in `lib/coaching/orchestration/generateCoachingPlan.ts`.

Current flow:

1. Raw intake is sent only to `intake_compression`.
2. The compressed intake is parsed and used as the privacy-minimized source for expert reviewers.
3. Expert reviewers run in sequence: medical safety screener, physio reviewer, fitness coach, mobility coach, and nutrition reviewer.
4. Expert outputs are normalized into `expertOutputSchema`.
5. `panel_brief` merges agreements, conflicts, safety gates, and plan direction.
6. `training_plan_writer` writes the training half of the plan as Markdown (named split, day-by-day exercise tables, phased progression) for the chosen `planDurationWeeks` (1, 4, 12, or 24).
7. `nutrition_plan_writer` writes the nutrition half as Markdown (daily targets, a Monday–Friday meal table, alternative approaches such as intermittent fasting, and per-phase calorie adjustments).
8. The two halves are concatenated into the plan Markdown and validated against `coachingPlanContentSchema` and `coachingAgentOutputsSchema`.

API orchestration starts in `app/api/coaching/generate-plan/route.ts`, which loads an owned intake submission, runs `generateCoachingPlan`, stores the plan, and creates an `in_review` review state.

## Firestore access

Coaching persistence is centralized under `lib/coaching/db/` so React pages and components do not import Firebase or call Firestore directly. UI code should call route handlers or server-side services that depend on the repository interface.

- `lib/coaching/db/firebaseAdmin.ts` initializes the server-only Firebase Admin app and exports a Firestore client factory.
- `lib/coaching/db/coachingRepository.ts` defines the repository contract and TypeScript records for intake submissions, generated plans, review state, and exports.
- `lib/coaching/db/firebaseCoachingRepository.ts` implements that contract with Firestore collections.
- `firestore.rules` is a draft client-access policy for future Firebase deployment. The server Admin SDK bypasses these rules, so server code must still validate ownership and authorization before using repository methods.

The initial Firestore implementation uses top-level collections with a required `userId` owner field:

- `coaching_intake_submissions` stores submitted intake payloads and their processing status.
- `coaching_plans` stores generated coaching plans, linked to an intake submission by `intakeSubmissionId`.
- `coaching_review_states` stores human or automated review status for a plan.
- `coaching_exports` stores export metadata such as PDF storage paths and expiring download URLs.

## PDF theme and sections

PDF assembly lives in `lib/coaching/pdf/`.

- `lib/coaching/pdf/CoachingPlanPdf.tsx` assembles the document.
- `lib/coaching/pdf/pdfTheme.ts` contains colors, typography, spacing, and section styles.
- `lib/coaching/pdf/renderCoachingPlanPdf.tsx` and `lib/coaching/pdf/renderPdf.tsx` render PDF bytes.
- `lib/coaching/pdf/sections/` contains individual blocks such as cover, plan summary, training, nutrition/recovery, and appendix sections.

PDF generation is exposed through `app/api/coaching/generate-pdf/route.ts`. V1 generates a PDF only after the associated review state is `approved` and returns the bytes directly as an `application/pdf` attachment.

## Admin behavior

Admin screens are intentionally unauthenticated placeholders for v1:

- `app/admin/submissions/page.tsx` lists demo submissions.
- `app/admin/submissions/[id]/page.tsx` shows one demo detail record.
- `docs/admin-pages.md` records the security TODO.

Before exposing real data, add authentication, authorization, and RBAC. After auth is in place, replace demo data with repository-backed reads through server code rather than importing Firebase into client components.

## Required Firebase environment variables

The Firebase Admin SDK runs only on the server. Configure one of these credential options:

### Option A: JSON service account

- `FIREBASE_SERVICE_ACCOUNT_KEY` — JSON string containing `project_id`, `client_email`, and `private_key`.

### Option B: individual service-account fields

- `FIREBASE_PROJECT_ID` — Firebase/GCP project ID.
- `FIREBASE_CLIENT_EMAIL` — service-account client email.
- `FIREBASE_PRIVATE_KEY` — service-account private key. Store newline characters as escaped `\\n` when the host requires single-line env vars.

### Option C: application default credentials

- `GOOGLE_APPLICATION_CREDENTIALS` — path to the service-account JSON file in environments that support application default credentials.
- `FIREBASE_PROJECT_ID` — recommended with application default credentials when the project cannot be inferred by the runtime.

Never expose these variables to the browser and do not prefix them with `NEXT_PUBLIC_`.
