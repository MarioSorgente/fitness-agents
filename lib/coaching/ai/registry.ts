import { createAnthropicProvider } from "./anthropicProvider";
import { createKimiProvider } from "./kimiProvider";
import { createOpenAiProvider } from "./openaiProvider";
import type { CoachingAiProviderRegistry } from "./provider";

/**
 * Default registry of every supported AI provider. Provider construction is
 * cheap and never throws on a missing API key — the key is only required when a
 * completion is actually requested — so callers can build the full registry and
 * rely on {@link runRoutedCompletion} to skip/fall through unconfigured providers.
 */
export function createDefaultProviderRegistry(): CoachingAiProviderRegistry {
  return {
    anthropic: createAnthropicProvider(),
    kimi: createKimiProvider(),
    openai: createOpenAiProvider(),
  };
}
