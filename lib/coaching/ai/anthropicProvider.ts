import type {
  CoachingAiCompletion,
  CoachingAiCompletionRequest,
  CoachingAiProvider,
} from "./provider";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicMessageResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

export type AnthropicProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
};

export function createAnthropicProvider(
  options: AnthropicProviderOptions = {},
): CoachingAiProvider {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const baseUrl = options.baseUrl ?? ANTHROPIC_MESSAGES_URL;

  return {
    id: "anthropic",
    async complete(request: CoachingAiCompletionRequest): Promise<CoachingAiCompletion> {
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not configured.");
      }

      const system = request.messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n");
      const messages = request.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        }));

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens ?? 1200,
          temperature: request.temperature ?? 0.2,
          ...(system ? { system } : {}),
          messages,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as AnthropicMessageResponse;

      if (!response.ok) {
        throw new Error(body.error?.message ?? `Anthropic request failed with ${response.status}.`);
      }

      const content = body.content
        ?.filter((block) => block.type === "text" && block.text)
        .map((block) => block.text)
        .join("\n")
        .trim();

      if (!content) {
        throw new Error("Anthropic returned an empty response.");
      }

      return {
        content,
        provider: "anthropic",
        model: request.model,
      };
    },
  };
}
