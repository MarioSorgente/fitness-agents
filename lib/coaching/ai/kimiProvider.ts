import type {
  CoachingAiCompletion,
  CoachingAiCompletionRequest,
  CoachingAiProvider,
} from "./provider";

const KIMI_CHAT_COMPLETIONS_URL = "https://api.moonshot.ai/v1/chat/completions";

type KimiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type KimiProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
};

export function createKimiProvider(options: KimiProviderOptions = {}): CoachingAiProvider {
  const apiKey = options.apiKey ?? process.env.KIMI_API_KEY ?? process.env.MOONSHOT_API_KEY;
  const baseUrl = options.baseUrl ?? KIMI_CHAT_COMPLETIONS_URL;

  return {
    id: "kimi",
    async complete(request: CoachingAiCompletionRequest): Promise<CoachingAiCompletion> {
      if (!apiKey) {
        throw new Error("KIMI_API_KEY or MOONSHOT_API_KEY is not configured.");
      }

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens ?? 1200,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as KimiChatCompletionResponse;

      if (!response.ok) {
        throw new Error(body.error?.message ?? `Kimi request failed with ${response.status}.`);
      }

      const content = body.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("Kimi returned an empty response.");
      }

      return {
        content,
        provider: "kimi",
        model: request.model,
      };
    },
  };
}
