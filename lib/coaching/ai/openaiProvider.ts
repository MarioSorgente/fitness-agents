import type {
  CoachingAiCompletion,
  CoachingAiCompletionRequest,
  CoachingAiProvider,
} from "./provider";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type OpenAiProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
};

export function createOpenAiProvider(options: OpenAiProviderOptions = {}): CoachingAiProvider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = options.baseUrl ?? OPENAI_CHAT_COMPLETIONS_URL;

  return {
    id: "openai",
    async complete(request: CoachingAiCompletionRequest): Promise<CoachingAiCompletion> {
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured.");
      }

      const controller = new AbortController();
      const timeoutMs = 90_000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetch(baseUrl, {
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
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`OpenAI request timed out after ${timeoutMs / 1000}s.`);
        }
        throw error;
      }
      clearTimeout(timeoutId);
      const body = (await response.json().catch(() => ({}))) as OpenAiChatCompletionResponse;

      if (!response.ok) {
        throw new Error(body.error?.message ?? `OpenAI request failed with ${response.status}.`);
      }

      const content = body.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("OpenAI returned an empty response.");
      }

      return {
        content,
        provider: "openai",
        model: request.model,
      };
    },
  };
}
