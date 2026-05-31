# Coaching AI Providers

Store AI provider integration code here.

This folder is for:

- Provider clients and adapters.
- Model selection and provider settings.
- API key and environment-variable wiring.
- Prompt execution helpers.
- Streaming, retries, timeouts, rate-limit handling, and logging hooks.

## `AI_PROVIDER` routing semantics

`AI_PROVIDER` is the preferred premium synthesis provider for the final moderator, not the only provider for the whole coaching workflow.

- `AI_PROVIDER=anthropic` means the production final moderator prefers the Anthropic main model first, intended to be Anthropic Opus via `ANTHROPIC_MODEL_MAIN` or the default Opus model.
- Cheap expert-panel steps still use fast models first: Kimi fast, then OpenAI fast, then Anthropic fast.
- Fallback order is explicit per task tier:
  - Fast / cheap panel tier: Kimi fast → OpenAI fast → Anthropic fast.
  - Main / premium synthesis tier: preferred `AI_PROVIDER` main model → remaining main providers in the default Anthropic → OpenAI → Kimi order.
- Because only the final moderator uses the main premium synthesis route, setting `AI_PROVIDER=anthropic` does not send every subtask to Opus.

Mario should edit this folder when changing provider configuration, model choices, execution parameters, or provider-specific behavior. Prompt text belongs in `../prompts/`; workflow decisions belong in `../orchestration/`.
