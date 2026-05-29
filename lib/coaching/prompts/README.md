# Coaching Prompts

Store prompt source files and prompt composition utilities here.

Use this folder to keep prompt text versioned and close to the coaching system. Prefer small, named prompt modules over large inline strings in orchestration code.

Mario should edit:

- `shared/` for reusable coaching voice, safety, formatting, and data-handling instructions.
- `agents/` for prompts that belong to one specialized coaching agent.

Provider-specific execution settings belong in `../ai/`; workflow sequencing belongs in `../orchestration/`.
