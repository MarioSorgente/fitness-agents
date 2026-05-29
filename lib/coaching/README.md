# Coaching Architecture

This directory contains the coaching-plan generation system. Keep coaching-specific form definitions, prompt text, orchestration, schemas, AI provider wiring, persistence, and PDF rendering here so the product flow is easy to find and extend.

## Folder map

- `form/` — intake form field definitions, labels, help text, validation copy, defaults, and UI-facing grouping metadata.
- `prompts/` — prompt source files and prompt composition helpers.
  - `prompts/shared/` — reusable prompt fragments, coach voice rules, safety guidance, formatting standards, and data-normalization instructions used by multiple agents.
  - `prompts/agents/` — individual agent prompts for specialized coaching roles such as assessment, programming, nutrition, recovery, review, or final plan synthesis.
- `orchestration/` — workflow logic that decides which agents run, in what order, with which inputs, retries, fallbacks, and how outputs are merged.
- `schemas/` — Zod schemas, TypeScript types, JSON contracts, and structured-output definitions shared by forms, agents, database writes, and PDF rendering.
- `ai/` — AI provider configuration, model selection, API clients, rate-limit handling, provider-specific adapters, and prompt execution utilities.
- `db/` — database clients, document mappers, repository functions, migrations or seed helpers, and persistence rules for coaching plans.
- `pdf/` — PDF document assembly, theme tokens, page layout, typography, global styling, and export helpers.
  - `pdf/sections/` — reusable PDF section components such as overview, goals, weekly schedule, workouts, nutrition, recovery, disclaimers, and appendices.

## Where Mario should edit

- **Prompts:** edit shared guidance in `prompts/shared/` and agent-specific instructions in `prompts/agents/`.
- **Form fields:** edit intake questions and field metadata in `form/`.
- **Provider settings:** edit model/provider selection, credentials wiring, and execution options in `ai/`.
- **PDF styling:** edit document-level layout and theme choices in `pdf/`; edit individual rendered blocks in `pdf/sections/`.
- **Orchestration logic:** edit agent sequencing, branching, retries, and output-combination rules in `orchestration/`.

Keep cross-cutting contracts in `schemas/` first, then import those contracts from the folders that consume them.
