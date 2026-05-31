# Coaching System Map

## Persistence boundary

Coaching persistence is centralized under `lib/coaching/db/` so React pages and components do not import Firebase or call Firestore directly. UI code should call server actions, route handlers, or orchestration services that depend on the repository interface instead.

- `lib/coaching/db/firebaseAdmin.ts` initializes the server-only Firebase Admin app and exports a Firestore client factory.
- `lib/coaching/db/coachingRepository.ts` defines the repository contract and TypeScript records for intake submissions, generated plans, review state, and exports.
- `lib/coaching/db/firebaseCoachingRepository.ts` implements that contract with Firestore collections.
- `firestore.rules` is a draft client-access policy for future Firebase deployment. The server Admin SDK bypasses these rules, so server code must still validate ownership and authorization before using repository methods.

## Firestore collections

The initial Firestore implementation uses top-level collections with a required `userId` owner field:

- `coaching_intake_submissions` stores submitted intake payloads and their processing status.
- `coaching_plans` stores generated coaching plans, linked to an intake submission by `intakeSubmissionId`.
- `coaching_review_states` stores human or automated review status for a plan.
- `coaching_exports` stores export metadata such as PDF storage paths and expiring download URLs.

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

## AI provider routing

`AI_PROVIDER` is a premium synthesis preference, not a global provider lock. In production mode, the orchestration keeps cheaper/high-volume expert-panel work on fast models first, then reserves the preferred main model tier for the final moderator synthesis step.

- `AI_PROVIDER=anthropic` means the final moderator prefers Anthropic Opus first.
- Cheap and high-volume steps (`intake_compression`, expert reviewers, and `panel_brief`) still try Kimi fast first, then OpenAI fast, then Anthropic fast.
- The final moderator fallback order is explicit per main-model tier: the preferred `AI_PROVIDER` first, then the remaining main providers in the default order Anthropic, OpenAI, Kimi.
- This routing prevents Anthropic Opus from being used for every subtask while still allowing Opus to synthesize the final plan when Anthropic is the preferred premium provider.

Task-tier fallback summary:

| Task tier                | Steps                                             | Production fallback order                                                                        |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Fast / cheap panel       | Intake compression, expert reviewers, panel brief | Kimi fast → OpenAI fast → Anthropic fast                                                         |
| Main / premium synthesis | Final moderator                                   | Preferred `AI_PROVIDER` main model → remaining main providers in Anthropic → OpenAI → Kimi order |

The model names can be overridden with `KIMI_MODEL_FAST`, `OPENAI_MODEL_FAST`, `ANTHROPIC_MODEL_FAST`, `ANTHROPIC_MODEL_MAIN`, `OPENAI_MODEL_MAIN`, and `KIMI_MODEL_MAIN` without changing the tier-level fallback order.
