# AI Handoff

This file is the fast-start brief for Codex, Claude, or any other coding agent continuing the fitness-agents project. Read it first, then inspect only the files relevant to the change.

## What has been built

- A Next.js app with a coaching landing page, intake page, thank-you page, and placeholder admin submission pages.
- A client-side coaching intake form that posts to `/api/coaching/submit-intake` and redirects to the thank-you page with a submission reference.
- Firestore repository interfaces and a Firebase Admin implementation for intake submissions, coaching plans, review states, and exports.
- API routes to submit intake payloads, generate coaching plans, update plans/review data, and generate approved-plan PDFs.
- Multi-provider AI routing for Kimi, OpenAI, and Anthropic with test and production route tiers.
- A multi-step coaching orchestration pipeline: intake compression, expert panel review, panel brief, and final moderator synthesis.
- Zod schemas for intake payloads, expert outputs, coaching plans, review states, and PDF-generation requests.
- PDF rendering components, theme tokens, and sections for coaching plan exports.
- Documentation for admin security status and this coaching-system map.

## Key files

### Product routes and UI

- `app/page.tsx` — landing page and navigation to the intake and admin demo flows.
- `app/coaching/intake/page.tsx` — intake page shell and explanatory copy.
- `app/coaching/intake/CoachingIntakeForm.tsx` — interactive input form and POST mapping to `/api/coaching/submit-intake`.
- `app/coaching/thank-you/page.tsx` — post-submit confirmation page.
- `app/admin/submissions/page.tsx` — demo admin list page.
- `app/admin/submissions/[id]/page.tsx` — demo admin detail page.
- `app/globals.css` — shared visual system, form controls, cards, admin tables, warning panels, and home-page styles.

### API routes

- `app/api/coaching/submit-intake/route.ts` — validates and stores intake submissions.
- `app/api/coaching/generate-plan/route.ts` — loads an intake, runs orchestration, stores the generated plan, and creates review state.
- `app/api/coaching/update-plan/route.ts` — updates plan/review state data.
- `app/api/coaching/generate-pdf/route.ts` — renders approved plans as PDF downloads.

### Coaching internals

- `lib/coaching/schemas/intakeSchema.ts` — intake and compact client profile contracts.
- `lib/coaching/schemas/coachingPlanSchema.ts` — plan, review, agent-output, and PDF request contracts.
- `lib/coaching/schemas/expertOutputSchema.ts` — expert panel and panel brief contracts.
- `lib/coaching/orchestration/generateCoachingPlan.ts` — v1 end-to-end coaching workflow and inline prompts.
- `lib/coaching/ai/provider.ts` — provider IDs, model defaults, route selection, and fallback execution.
- `lib/coaching/ai/kimiProvider.ts`, `lib/coaching/ai/openaiProvider.ts`, `lib/coaching/ai/anthropicProvider.ts` — provider adapters.
- `lib/coaching/db/coachingRepository.ts` — persistence interface.
- `lib/coaching/db/firebaseAdmin.ts` — server-only Firebase Admin initialization.
- `lib/coaching/db/firebaseCoachingRepository.ts` — Firestore implementation.
- `lib/coaching/pdf/` — PDF rendering, theme, assembly, and sections.

### Documentation

- `docs/coaching-system-map.md` — where to edit each subsystem.
- `docs/admin-pages.md` — admin placeholder and auth/RBAC TODO.
- `lib/coaching/**/README.md` — folder-level intent notes.

## Environment variables

### Firebase Admin

Use one of these credential strategies:

- `FIREBASE_SERVICE_ACCOUNT_KEY` — full service-account JSON string.
- Or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
- Or `GOOGLE_APPLICATION_CREDENTIALS`, plus `FIREBASE_PROJECT_ID` when project inference is unreliable.

Do not prefix Firebase Admin secrets with `NEXT_PUBLIC_`.

### AI providers

- `AI_PROVIDER` — preferred main provider for final production synthesis; valid values are `anthropic`, `openai`, or `kimi`.
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `KIMI_API_KEY`

### Optional model overrides

- `KIMI_MODEL_FAST`
- `KIMI_MODEL_MAIN`
- `OPENAI_MODEL_FAST`
- `OPENAI_MODEL_MAIN`
- `ANTHROPIC_MODEL_FAST`
- `ANTHROPIC_MODEL_MAIN`

## Local testing steps

1. Install dependencies with `pnpm install` if `node_modules` is missing.
2. Add Firebase Admin credentials to `.env.local` before testing real intake submission persistence.
3. Add provider API keys before testing real plan generation.
4. Run `pnpm format:check` to verify formatting.
5. Run `pnpm build` to verify TypeScript and Next.js production compilation.
6. Run `pnpm dev` and open:
   - `http://localhost:3000/`
   - `http://localhost:3000/coaching/intake`
   - `http://localhost:3000/admin/submissions`
7. Submit the intake form only after Firebase Admin credentials are present; otherwise the API route is expected to return a server configuration error.

## Known TODOs

- Add authentication, authorization, and RBAC before exposing admin pages or real submission data.
- Replace admin demo data with repository-backed reads after admin protection exists.
- Move inline prompt strings from `lib/coaching/orchestration/generateCoachingPlan.ts` into reusable modules under `lib/coaching/prompts/`.
- Promote hard-coded intake field definitions from `app/coaching/intake/CoachingIntakeForm.tsx` into `lib/coaching/form/` when fields need reuse across multiple clients or screens.
- Add explicit goal-routing logic if different goals need different agent branches, plan templates, or validation rules.
- Add automated tests for API route validation, provider fallback ordering, orchestration output normalization, repository mappers, and PDF approval gates.
- Add a stable PDF storage/export flow if reusable download URLs become a product requirement.
- Add user identity beyond the temporary email-as-userId intake mapping.

## How Codex or Claude should continue without re-explaining context

Start each future task with this sequence:

1. Read `docs/ai-handoff.md` for current system context.
2. Read `docs/coaching-system-map.md` for the edit location that matches the request.
3. Check `git status --short` before editing so you do not overwrite someone else's work.
4. For UI or form changes, inspect `app/page.tsx`, `app/coaching/intake/`, and `app/globals.css`.
5. For payload changes, update schemas first in `lib/coaching/schemas/`, then update the form/API/orchestration/PDF consumers.
6. For prompt or workflow changes, edit `lib/coaching/orchestration/generateCoachingPlan.ts` unless prompt modules have already been extracted into `lib/coaching/prompts/`.
7. For provider routing changes, edit `lib/coaching/ai/provider.ts` and keep docs in sync.
8. For Firestore changes, edit the repository interface before the Firebase implementation and keep route handlers behind repository calls.
9. Run formatting and build checks before handing off.
10. Document any remaining assumptions or TODOs in the final response and, if durable, in this file.
