# Coaching Database

Store coaching persistence code here.

This folder is for:

- Database client setup used by coaching features.
- Repository functions for reading and writing intake submissions, generated plans, review state, and exports.
- Mappers between schema objects and stored documents.
- Migration, seed, or backfill helpers related to coaching data.

## Firebase repository boundary

- `firebaseAdmin.ts` initializes the server-side Firebase Admin SDK and exports the shared Firestore client factory.
- `coachingRepository.ts` defines persistence interfaces and record shapes used by coaching orchestration, route handlers, and server actions.
- `firebaseCoachingRepository.ts` implements the repository interface with Firestore collections.

Keep Firestore imports and calls in this folder or server-only modules that compose repositories. React pages and components should not import Firebase clients directly.

Mario should edit this folder when changing how coaching data is stored or retrieved. Shared document contracts should live in `../schemas/`.
