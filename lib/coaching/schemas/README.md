# Coaching Schemas

Store shared coaching data contracts here.

This folder is for:

- Zod schemas and inferred TypeScript types.
- Structured-output schemas for AI responses.
- Intake form contracts.
- Database document shapes.
- PDF view models and export payload contracts.

Mario should edit this folder before changing data shapes consumed by multiple parts of the coaching system. Keep schemas as the source of truth and import them from form, orchestration, AI, database, and PDF code.
