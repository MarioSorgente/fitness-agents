export type CoachingAiProviderId = "anthropic" | "kimi" | "openai";

export type CoachingModelTier = "fast" | "main";

export type CoachingOrchestrationMode = "test" | "production";

export type CoachingStepId =
  | "intake_compression"
  | "medical_safety_screener"
  | "physio_reviewer"
  | "fitness_coach"
  | "mobility_coach"
  | "nutrition_reviewer"
  | "panel_brief"
  | "final_moderator";

export type CoachingStepRoute = {
  provider: CoachingAiProviderId;
  model: string;
  tier: CoachingModelTier;
};

export type CoachingAiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CoachingAiCompletionRequest = {
  model: string;
  messages: CoachingAiMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type CoachingAiCompletion = {
  content: string;
  provider: CoachingAiProviderId;
  model: string;
};

export interface CoachingAiProvider {
  id: CoachingAiProviderId;
  complete(request: CoachingAiCompletionRequest): Promise<CoachingAiCompletion>;
}

export type CoachingAiProviderRegistry = Partial<Record<CoachingAiProviderId, CoachingAiProvider>>;

export const CHEAP_OR_HEAVY_STEPS: readonly CoachingStepId[] = [
  "intake_compression",
  "medical_safety_screener",
  "physio_reviewer",
  "fitness_coach",
  "mobility_coach",
  "nutrition_reviewer",
  "panel_brief",
] as const;

export const FINAL_MODERATOR_STEP: CoachingStepId = "final_moderator";

export const CHEAP_STEP_PRODUCTION_ROUTE: readonly CoachingStepRoute[] = [
  { provider: "kimi", model: "moonshot-v1-8k", tier: "fast" },
  { provider: "openai", model: "gpt-4.1-nano", tier: "fast" },
  { provider: "anthropic", model: "claude-haiku-4-5", tier: "fast" },
] as const;

export const FINAL_MODERATOR_PRODUCTION_ROUTE: readonly CoachingStepRoute[] = [
  { provider: "anthropic", model: "claude-opus-4-7", tier: "main" },
  { provider: "openai", model: "gpt-4.1-mini", tier: "main" },
  { provider: "kimi", model: "moonshot-v1-32k", tier: "main" },
] as const;

export const TEST_ROUTE: readonly CoachingStepRoute[] = [
  { provider: "kimi", model: "moonshot-v1-8k", tier: "fast" },
  { provider: "openai", model: "gpt-4.1-nano", tier: "fast" },
  { provider: "anthropic", model: "claude-haiku-4-5", tier: "fast" },
] as const;

export function getRoutesForStep(
  step: CoachingStepId,
  mode: CoachingOrchestrationMode,
): readonly CoachingStepRoute[] {
  if (mode === "test") {
    return TEST_ROUTE;
  }

  return step === FINAL_MODERATOR_STEP
    ? FINAL_MODERATOR_PRODUCTION_ROUTE
    : CHEAP_STEP_PRODUCTION_ROUTE;
}

export async function runRoutedCompletion(
  providers: CoachingAiProviderRegistry,
  step: CoachingStepId,
  mode: CoachingOrchestrationMode,
  request: Omit<CoachingAiCompletionRequest, "model">,
): Promise<CoachingAiCompletion> {
  const routes = getRoutesForStep(step, mode);
  const failures: string[] = [];

  for (const route of routes) {
    const provider = providers[route.provider];

    if (!provider) {
      failures.push(`${route.provider}/${route.model}: provider is not configured`);
      continue;
    }

    try {
      return await provider.complete({
        ...request,
        model: route.model,
      });
    } catch (error) {
      failures.push(
        `${route.provider}/${route.model}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  throw new Error(`No AI route succeeded for ${step}. ${failures.join("; ")}`);
}
