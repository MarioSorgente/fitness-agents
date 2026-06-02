# Fitness‑Agents — Full Codebase & Prompt Reference

> Single source of truth for what this app is, how it is wired, and **exactly where every AI
> prompt lives**. If something here disagrees with the code, the code wins — update this file.
> Deeper dives: [coaching-system-map.md](coaching-system-map.md), [ai-handoff.md](ai-handoff.md),
> [admin-pages.md](admin-pages.md).

---

## 1. What the app does

A coach (Mario) collects a client through a public **intake form**, then privately runs a panel of
**AI agents** that draft a complete **fitness + nutrition plan**. The coach reviews/edits the
Markdown, then exports a **PDF** for the client.

Three actors:
- **Client** — fills the public intake form. No login.
- **Admin (coach)** — logs in, generates/edits plans, exports PDFs. Email‑allowlisted.
- **AI panel** — 9 sequential agents (see §5) that turn the intake into a plan.

---

## 2. Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript 5.8 |
| Package manager | pnpm 10 |
| Validation | Zod |
| AI providers | Anthropic (Claude), OpenAI, Kimi/Moonshot — called server‑side over `fetch` |
| Database | Firebase Firestore **or** local JSON file (auto‑selected) |
| Auth | Firebase session cookie, email allowlist |
| PDF | `pdfkit` + `marked` (Markdown → PDF) |
| Markdown preview | `marked` + `dompurify` |

All API routes run on the Node.js runtime (`export const runtime = "nodejs"`).

---

## 3. Top‑level directory map

```
fitness-agents/
├─ app/                         # Next.js App Router (pages + API routes)
│  ├─ page.tsx                  # Landing page
│  ├─ layout.tsx                # Root layout
│  ├─ globals.css               # Global styles
│  ├─ intake/                   # Public standalone intake page  → /intake
│  ├─ coaching/
│  │  ├─ intake/                # Intake form component + page  → /coaching/intake
│  │  ├─ submitted/             # Public "submitted" confirmation
│  │  └─ thank-you/             # Internal thank-you view
│  ├─ admin/                    # Admin area (auth-gated)
│  │  ├─ login/                 # Admin login form  → /admin/login
│  │  ├─ submissions/           # List + detail (plan generation UI)
│  │  └─ ...                    # layout, header, landing
│  └─ api/
│     ├─ admin/session/         # Create/destroy admin session cookie
│     └─ coaching/              # submit-intake, generate-plan, generate-pdf,
│                               # update-plan, test-orchestration
├─ lib/
│  └─ coaching/                 # ALL domain logic lives here
│     ├─ prompts/               # ⭐ EVERY AGENT PROMPT (see §6)
│     ├─ orchestration/         # Runs the agent pipeline + text fallback
│     ├─ ai/                    # Provider adapters + model-tier routing
│     ├─ schemas/               # Zod schemas (intake, plan, expert output)
│     ├─ form/                  # Intake form field/section definitions
│     ├─ markdown/              # Build the editable Markdown document + preview
│     ├─ pdf/                   # Markdown→PDF and structured→PDF renderers
│     ├─ db/                    # Repository pattern (Firebase | local file)
│     ├─ auth/                  # Admin auth + Firebase client
│     └─ api/                   # Shared route helpers (errors, parsing, guards)
└─ docs/                        # This file and other references
```

---

## 4. End‑to‑end data flow

```
CLIENT                          ADMIN (coach)                         AI PANEL (server)
  │                                  │
  │ fill intake form                 │
  ▼                                  │
/coaching/intake (CoachingIntakeForm.tsx)
  │ POST /api/coaching/submit-intake │
  ▼                                  │
 validate (coachingIntakeSchema) → store IntakeSubmission (repository)
                                     │
                                     │ opens /admin/submissions/[id]
                                     │ picks Plan length + Quality, clicks Generate
                                     │ POST /api/coaching/generate-plan (SSE stream)
                                     ▼
                          generateCoachingPlan()  ───────────────►  9-step pipeline (§5)
                                     │                               emits step_started/…/step_completed
                                     │  assemblePlanDocument():
                                     │   Part 1 = deterministic intake summary
                                     │   Part 2 = AI training + nutrition Markdown
                                     │   + disclaimer
                                     ▼
                          stream `plan_ready` { markdown, plan } → client renders editable Markdown
                                     │ (best-effort persist plan + review state)
                                     │
                                     │ edits Markdown, clicks Generate PDF
                                     │ POST /api/coaching/generate-pdf { markdown }
                                     ▼
                          renderMarkdownPdf() → PDF download
```

Key property: **safety/medical facts in Part 1 come straight from the submission**, never from an
LLM, so they are always faithful. The raw intake is only ever sent to step 1 (compression); every
later agent sees only the privacy‑minimized brief.

---

## 5. The AI agent pipeline (9 steps)

Defined and sequenced in
[lib/coaching/orchestration/generateCoachingPlan.ts](../lib/coaching/orchestration/generateCoachingPlan.ts).
That file only **wires** the steps — all prompt wording lives in `lib/coaching/prompts/` (§6).

| # | Step id | Role | Model tier | Output |
| - | --- | --- | --- | --- |
| 1 | `intake_compression` | Distills raw intake → privacy‑minimized JSON brief (only step that sees raw intake) | fast | JSON brief |
| 2 | `medical_safety_screener` | Flags medical red flags / clearance needs | fast | JSON (findings/recommendations/risks/followUps) |
| 3 | `physio_reviewer` | Movement limits, pain, regressions/progressions | fast | JSON |
| 4 | `fitness_coach` | Concrete training direction (split, exercises, schemes) | fast | JSON |
| 5 | `mobility_coach` | Mobility / warm‑up / recovery priorities | fast | JSON |
| 6 | `nutrition_reviewer` | Calorie/macro targets, restrictions, eating approaches | fast | JSON |
| 7 | `panel_brief` | Merges experts → agreements/conflicts/safety gates/direction | fast | JSON |
| 8 | `training_plan_writer` | Writes TRAINING half as Markdown (named split, day‑by‑day exercise tables, phased progression) | **main (premium)** | Markdown |
| 9 | `nutrition_plan_writer` | Writes NUTRITION half as Markdown (daily targets, Mon–Fri meal table, alternatives, per‑phase scaling) | **main (premium)** | Markdown |

Steps 1 + 7 are synthesis glue; 2–6 are the parallel‑style "panel"; 8–9 are the client‑facing
writers. The two writer outputs are concatenated (training, a `---` rule, then nutrition) to form
Part 2 of the document.

**Plan length** (`planDurationWeeks` = 1 / 4 / 12 / 24) controls how many training **phases** the
writers produce and their output‑token budget — see
[prompts/shared/planDuration.ts](../lib/coaching/prompts/shared/planDuration.ts).

**Quality toggle** maps to `orchestrationMode`: `production` ("Final") uses premium models for the
two writers; `test` ("Draft") keeps everything on cheap/fast models.

---

## 6. ⭐ Where every prompt lives

All prompt text is under **[lib/coaching/prompts/](../lib/coaching/prompts/)**, one file per agent.
[index.ts](../lib/coaching/prompts/index.ts) is the registry; [README.md](../lib/coaching/prompts/README.md)
repeats this table.

### Per‑agent prompt files — `prompts/agents/`

| # | Step id | File |
| - | --- | --- |
| 1 | `intake_compression` | [agents/intakeCompression.ts](../lib/coaching/prompts/agents/intakeCompression.ts) |
| 2 | `medical_safety_screener` | [agents/medicalSafetyScreener.ts](../lib/coaching/prompts/agents/medicalSafetyScreener.ts) |
| 3 | `physio_reviewer` | [agents/physioReviewer.ts](../lib/coaching/prompts/agents/physioReviewer.ts) |
| 4 | `fitness_coach` | [agents/fitnessCoach.ts](../lib/coaching/prompts/agents/fitnessCoach.ts) |
| 5 | `mobility_coach` | [agents/mobilityCoach.ts](../lib/coaching/prompts/agents/mobilityCoach.ts) |
| 6 | `nutrition_reviewer` | [agents/nutritionReviewer.ts](../lib/coaching/prompts/agents/nutritionReviewer.ts) |
| 7 | `panel_brief` | [agents/panelBrief.ts](../lib/coaching/prompts/agents/panelBrief.ts) |
| 8 | `training_plan_writer` | [agents/trainingPlanWriter.ts](../lib/coaching/prompts/agents/trainingPlanWriter.ts) |
| 9 | `nutrition_plan_writer` | [agents/nutritionPlanWriter.ts](../lib/coaching/prompts/agents/nutritionPlanWriter.ts) |

### Shared fragments — `prompts/shared/`

| File | What it controls |
| --- | --- |
| [shared/expertSystemTemplate.ts](../lib/coaching/prompts/shared/expertSystemTemplate.ts) | The role wrapper + strict JSON output contract shared by steps **2–6**, plus the user message handing them the compressed intake. Edit once → affects all five reviewers. |
| [shared/planDuration.ts](../lib/coaching/prompts/shared/planDuration.ts) | The phase/progression wording for 1 / 4 / 12 / 24‑week plans (injected into the training writer) and the per‑length output‑token budget. |

### Convention
- Static prompt → exported `const` string.
- Prompt needing runtime values (intake, title, duration) → exported `buildXxx(...)` function.
- Model / temperature / max‑tokens are **not** prompt text — they live in `ai/` (§8) and the
  orchestrator’s per‑step request.

### Prompt text NOT yet in this folder (deterministic, not LLM)
- Final document disclaimer + Part 1/Part 2 framing → [markdown/buildPlanDocument.ts](../lib/coaching/markdown/buildPlanDocument.ts).
- Deterministic plan used when all AI providers fail → [orchestration/buildTextFallback.ts](../lib/coaching/orchestration/buildTextFallback.ts).

---

## 7. Module reference (by directory)

### `app/` — routes & UI
| Path | Purpose |
| --- | --- |
| [app/page.tsx](../app/page.tsx) | Landing page |
| [app/intake/page.tsx](../app/intake/page.tsx) · [app/coaching/intake/](../app/coaching/intake/) | Public intake form ([CoachingIntakeForm.tsx](../app/coaching/intake/CoachingIntakeForm.tsx)) |
| [app/coaching/submitted/](../app/coaching/submitted/) · [thank-you/](../app/coaching/thank-you/) | Post‑submit confirmation views |
| [app/admin/login/](../app/admin/login/) | Admin login ([AdminLoginForm.tsx](../app/admin/login/AdminLoginForm.tsx)) |
| [app/admin/submissions/page.tsx](../app/admin/submissions/page.tsx) | All submissions list |
| [app/admin/submissions/[id]/page.tsx](../app/admin/submissions/%5Bid%5D/page.tsx) | Submission detail; hosts the plan workbench |
| [app/admin/submissions/SubmissionWorkflow.tsx](../app/admin/submissions/SubmissionWorkflow.tsx) | **Plan generation UI**: length + quality dropdowns, agent timeline, Markdown editor, Save/PDF |
| [app/admin/submissions/actions.ts](../app/admin/submissions/actions.ts) | Server actions for the admin list |

### `lib/coaching/orchestration/`
- [generateCoachingPlan.ts](../lib/coaching/orchestration/generateCoachingPlan.ts) — runs the 9 steps, assembles `planMarkdown`, returns `{ plan, planMarkdown, agentOutputs }`. Exports `COACHING_AGENT_TIMELINE` and re‑exports `PLAN_DURATION_WEEKS` / `DEFAULT_PLAN_DURATION_WEEKS`.
- [buildTextFallback.ts](../lib/coaching/orchestration/buildTextFallback.ts) — deterministic plan when AI is unavailable.

### `lib/coaching/ai/` — provider adapters + routing (§8)
- [provider.ts](../lib/coaching/ai/provider.ts) — types, `CoachingStepId`, model‑tier routing (`getRoutesForStep`, `runRoutedCompletion`), the writer long‑output guard.
- [anthropicProvider.ts](../lib/coaching/ai/anthropicProvider.ts) · [openaiProvider.ts](../lib/coaching/ai/openaiProvider.ts) · [kimiProvider.ts](../lib/coaching/ai/kimiProvider.ts) — one `complete()` adapter each (90s timeout).

### `lib/coaching/schemas/` — data model (§9)
- [intakeSchema.ts](../lib/coaching/schemas/intakeSchema.ts) — `CoachingIntake`, safety‑status derivation, JSON helpers.
- [coachingPlanSchema.ts](../lib/coaching/schemas/coachingPlanSchema.ts) — plan content, agent outputs, PDF request.
- [expertOutputSchema.ts](../lib/coaching/schemas/expertOutputSchema.ts) — expert output + panel brief shapes.

### `lib/coaching/form/` — intake form definition
- [intakeFields.ts](../lib/coaching/form/intakeFields.ts) (all fields), [intakeSections.ts](../lib/coaching/form/intakeSections.ts) (10 steps), [intakeOptions.ts](../lib/coaching/form/intakeOptions.ts) (dropdown options), [sampleIntake.ts](../lib/coaching/form/sampleIntake.ts) (demo data).

### `lib/coaching/markdown/`
- [buildIntakeSummary.ts](../lib/coaching/markdown/buildIntakeSummary.ts) — deterministic Part 1.
- [buildPlanDocument.ts](../lib/coaching/markdown/buildPlanDocument.ts) — combines Part 1 + Part 2 + disclaimer.
- [MarkdownPreview.tsx](../lib/coaching/markdown/MarkdownPreview.tsx) — sanitized HTML preview.

### `lib/coaching/pdf/`
- [renderMarkdownPdf.ts](../lib/coaching/pdf/renderMarkdownPdf.ts) — **primary** path: edited Markdown → PDF (handles headings, lists, blockquotes, tables).
- [renderPdf.tsx](../lib/coaching/pdf/renderPdf.tsx) / [renderCoachingPlanPdf.tsx](../lib/coaching/pdf/renderCoachingPlanPdf.tsx) / [CoachingPlanPdf.tsx](../lib/coaching/pdf/CoachingPlanPdf.tsx) + [sections/](../lib/coaching/pdf/sections/) — structured (legacy) renderer.
- [pdfTheme.ts](../lib/coaching/pdf/pdfTheme.ts) — fonts/colors.

### `lib/coaching/db/` — repository pattern (§10)
- [coachingRepository.ts](../lib/coaching/db/coachingRepository.ts) — the `CoachingRepository` interface + record types.
- [coachingRepositoryFactory.ts](../lib/coaching/db/coachingRepositoryFactory.ts) — picks Firebase vs local from env.
- [firebaseCoachingRepository.ts](../lib/coaching/db/firebaseCoachingRepository.ts) · [localCoachingRepository.ts](../lib/coaching/db/localCoachingRepository.ts) · [firebaseAdmin.ts](../lib/coaching/db/firebaseAdmin.ts).

### `lib/coaching/auth/`
- [adminAuth.ts](../lib/coaching/auth/adminAuth.ts) — `requireAdminPage` / `requireAdminApi`, email allowlist, dev bypass.
- [firebaseClient.ts](../lib/coaching/auth/firebaseClient.ts) — client SDK for login.

### `lib/coaching/api/`
- [routeUtils.ts](../lib/coaching/api/routeUtils.ts) — `ApiRouteError`, `handleRouteError`, `parseJsonBody`, ownership guards, shared zod field schemas.

---

## 8. API routes

All under [app/api/](../app/api/). Coaching routes are **admin‑only** except `submit-intake`.

| Method · Path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/coaching/submit-intake` | public | Validate + store an `IntakeSubmission` |
| `POST /api/coaching/generate-plan` | admin | Run the 9‑step pipeline; **SSE stream** of progress + final `plan_ready`. Body: `{ userId, intakePayload?, intakeSubmissionId?, orchestrationMode, planDurationWeeks }`. `maxDuration = 300` |
| `POST /api/coaching/generate-pdf` | admin | Render edited Markdown (or stored/inline plan) to PDF. `maxDuration = 60` |
| `POST /api/coaching/update-plan` | admin | Persist edited Markdown / review state |
| `POST /api/coaching/test-orchestration` | admin | Smoke‑test the pipeline on a safe fixture; returns providers/models used |
| `POST /api/admin/session` | public→admin | Exchange a Firebase ID token for the `__session` cookie |

---

## 9. Data model (schemas)

- **`CoachingIntake`** ([intakeSchema.ts](../lib/coaching/schemas/intakeSchema.ts)) — 100+ fields: profile, goals, training background, PAR‑Q health/safety, medical history, pain/injuries, lifestyle, nutrition, optional 3‑day food log, consent. `safetyStatus` (`clear` / `caution` / `medical_clearance_recommended`) is **derived** from the health answers, not asked.
- **`CoachingPlanContent`** ([coachingPlanSchema.ts](../lib/coaching/schemas/coachingPlanSchema.ts)) — `markdown` (the editable document, source of truth), plus metadata (`orchestrationMode`, `planDurationWeeks`, writer provider/model). `.catchall` makes it forward‑compatible.
- **`CoachingAgentOutputs`** — full audit trail: compressed intake, every expert output, panel brief, both writers, routing metadata.
- **`ExpertOutput` / `PanelBrief`** ([expertOutputSchema.ts](../lib/coaching/schemas/expertOutputSchema.ts)) — the JSON contracts for steps 2–7.

Repository record types (`IntakeSubmission`, `CoachingPlan`, `ReviewState`, `CoachingExport`) live in [coachingRepository.ts](../lib/coaching/db/coachingRepository.ts).

---

## 10. AI routing & model tiers

Routing logic: [lib/coaching/ai/provider.ts](../lib/coaching/ai/provider.ts).

- **Two tiers per provider**: `fast` (cheap, high‑volume) and `main` (premium synthesis).
- **`test` mode (Draft)** — every step on the `fast` tier. Panel order Kimi→OpenAI→Anthropic; the
  two **writers** reorder to **Anthropic→OpenAI→Kimi** (Kimi’s 8k context truncates long plans).
- **`production` mode (Final)** — panel stays `fast`; the two **writers** use the `main` tier with
  order: preferred `AI_PROVIDER` first, then Anthropic→OpenAI→Kimi.
- `runRoutedCompletion` tries routes in order and falls through on failure.

Default models (override via env):

| Provider | fast | main |
| --- | --- | --- |
| Anthropic | `claude-haiku-4-5` | `claude-opus-4-7` |
| OpenAI | `gpt-4.1-nano` | `gpt-4.1-mini` |
| Kimi | `moonshot-v1-8k` | `moonshot-v1-32k` |

---

## 11. Database / repository

[createCoachingRepository()](../lib/coaching/db/coachingRepositoryFactory.ts) auto‑selects a backend:

1. `COACHING_REPOSITORY=firebase|local` forces a choice.
2. Otherwise Firebase is used if any Firebase credential env is present.
3. Otherwise it falls back to the **local JSON file** repository (dev default).

Both implement the same `CoachingRepository` interface, so the rest of the app is storage‑agnostic.
On ephemeral/serverless storage the plan is also streamed inline to the client so PDF export works
without a second lookup.

---

## 12. Auth

[adminAuth.ts](../lib/coaching/auth/adminAuth.ts): the admin area is gated by a Firebase **session
cookie** (`__session`). The signed‑in email must be in the allowlist (`ADMIN_EMAILS`, default
`ms.sorgente@gmail.com`). `requireAdminPage()` redirects unauthenticated server components to
`/admin/login`; `requireAdminApi()` throws 401 in API routes. `ADMIN_AUTH_DISABLED=true` bypasses
auth **in development only**. The public intake flow has no auth by design.

---

## 13. PDF rendering

Two renderers ([pdf/](../lib/coaching/pdf/)):
- **`renderMarkdownPdf`** — primary. Takes the (edited) Markdown and renders via `marked` + `pdfkit`.
  This is what the admin "Generate PDF" button uses. Wide tables (the 6‑column exercise tables, the
  Mon–Fri meal table) are the main thing to watch here.
- **`renderCoachingPlanPdf`** — legacy structured renderer (cover/training/nutrition/appendix
  sections) kept for stored structured plans.

Text‑fallback plans are blocked from PDF export.

---

## 14. Environment variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic provider | required for Claude |
| `OPENAI_API_KEY` | OpenAI provider | |
| `KIMI_API_KEY` / `MOONSHOT_API_KEY` | Kimi provider | either works |
| `ANTHROPIC_MODEL_FAST` / `_MAIN` | routing | override default models |
| `OPENAI_MODEL_FAST` / `_MAIN` | routing | |
| `KIMI_MODEL_FAST` / `_MAIN` | routing | |
| `AI_PROVIDER` | routing | preferred provider for the premium writers |
| `COACHING_REPOSITORY` | db | `firebase` \| `local` (else auto) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | db/auth | JSON service account (admin SDK) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | db/auth | alt to the service‑account JSON |
| `GOOGLE_APPLICATION_CREDENTIALS` / `FIRESTORE_EMULATOR_HOST` | db | application‑default creds / emulator |
| `ADMIN_EMAILS` | auth | comma‑separated allowlist (default Mario) |
| `ADMIN_AUTH_DISABLED` | auth | `true` bypasses auth in dev only |
| `NODE_ENV` | auth | guards the dev bypass |

---

## 15. Run, build, test

```powershell
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build + typecheck + lint
pnpm lint
```

Manual end‑to‑end: open `/admin/submissions/[id]`, choose **12 weeks + Final**, **Generate draft**,
confirm the timeline shows `training_plan_writer` / `nutrition_plan_writer` on an Opus model, then
**Generate PDF**. `POST /api/coaching/test-orchestration` is a quick provider/model smoke test.

---

## 16. "I want to change X" — quick index

| Goal | Edit |
| --- | --- |
| Reword what an agent says | the agent’s file in [prompts/agents/](../lib/coaching/prompts/agents/) |
| Change the shared reviewer wrapper / JSON contract | [prompts/shared/expertSystemTemplate.ts](../lib/coaching/prompts/shared/expertSystemTemplate.ts) |
| Change phases / progression per plan length, or token budgets | [prompts/shared/planDuration.ts](../lib/coaching/prompts/shared/planDuration.ts) |
| Add/remove a pipeline step | [orchestration/generateCoachingPlan.ts](../lib/coaching/orchestration/generateCoachingPlan.ts) + `CoachingStepId` in [ai/provider.ts](../lib/coaching/ai/provider.ts) |
| Change which models/tiers run | [ai/provider.ts](../lib/coaching/ai/provider.ts) (or model env vars) |
| Add an intake question | [form/intakeFields.ts](../lib/coaching/form/intakeFields.ts) (+ section in [intakeSections.ts](../lib/coaching/form/intakeSections.ts), schema in [schemas/intakeSchema.ts](../lib/coaching/schemas/intakeSchema.ts)) |
| Change the plan‑length / quality dropdowns | [app/admin/submissions/SubmissionWorkflow.tsx](../app/admin/submissions/SubmissionWorkflow.tsx) |
| Change the final document framing / disclaimer | [markdown/buildPlanDocument.ts](../lib/coaching/markdown/buildPlanDocument.ts) |
| Change PDF appearance | [pdf/renderMarkdownPdf.ts](../lib/coaching/pdf/renderMarkdownPdf.ts) + [pdf/pdfTheme.ts](../lib/coaching/pdf/pdfTheme.ts) |
| Change who can access admin | `ADMIN_EMAILS` env / [auth/adminAuth.ts](../lib/coaching/auth/adminAuth.ts) |
