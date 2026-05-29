# Coaching Orchestration

Store workflow logic for coaching plan generation here.

This folder is for:

- Deciding which coaching agents run and in what order.
- Branching based on intake answers, plan type, risk flags, or missing information.
- Passing structured inputs between agents.
- Retrying, validating, or repairing agent outputs.
- Combining agent results into the final coaching plan contract.

Mario should edit this folder when changing the coaching workflow, agent sequencing, fallback behavior, or output-merging logic. Prompt wording belongs in `../prompts/`; provider settings belong in `../ai/`.
