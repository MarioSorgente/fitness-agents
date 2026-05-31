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

const DEFAULT_MODELS: Record<CoachingAiProviderId, Record<CoachingModelTier, string>> = {
  anthropic: {
    fast: "claude-haiku-4-5",
    main: "claude-opus-4-7",
  },
  kimi: {
    fast: "moonshot-v1-8k",
    main: "moonshot-v1-32k",
  },
  openai: {
    fast: "gpt-4.1-nano",
    main: "gpt-4.1-mini",
  },
};

const MODEL_ENV_NAMES: Record<CoachingAiProviderId, Record<CoachingModelTier, string>> = {
  anthropic: {
    fast: "ANTHROPIC_MODEL_FAST",
    main: "ANTHROPIC_MODEL_MAIN",
  },
  kimi: {
    fast: "KIMI_MODEL_FAST",
    main: "KIMI_MODEL_MAIN",
  },
  openai: {
    fast: "OPENAI_MODEL_FAST",
    main: "OPENAI_MODEL_MAIN",
  },
};

const CHEAP_STEP_PROVIDER_ORDER: readonly CoachingAiProviderId[] = ["kimi", "openai", "anthropic"];
const DEFAULT_PREMIUM_SYNTHESIS_PROVIDER_ORDER: readonly CoachingAiProviderId[] = [
  "anthropic",
  "openai",
  "kimi",
];

function isCoachingAiProviderId(value: string | undefined): value is CoachingAiProviderId {
  return value === "anthropic" || value === "kimi" || value === "openai";
}

function getConfiguredModel(provider: CoachingAiProviderId, tier: CoachingModelTier): string {
  const envValue = process.env[MODEL_ENV_NAMES[provider][tier]];

  const configuredModel = envValue?.trim();

  return configuredModel || DEFAULT_MODELS[provider][tier];
}

function routeFor(provider: CoachingAiProviderId, tier: CoachingModelTier): CoachingStepRoute {
  return {
    provider,
    model: getConfiguredModel(provider, tier),
    tier,
  };
}

function withPreferredProvider(
  providerOrder: readonly CoachingAiProviderId[],
  preferredProvider: CoachingAiProviderId,
): CoachingAiProviderId[] {
  return [preferredProvider, ...providerOrder.filter((provider) => provider !== preferredProvider)];
}

function getPremiumSynthesisProviderOrder(): CoachingAiProviderId[] {
  const preferredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (!isCoachingAiProviderId(preferredProvider)) {
    return [...DEFAULT_PREMIUM_SYNTHESIS_PROVIDER_ORDER];
  }

  return withPreferredProvider(DEFAULT_PREMIUM_SYNTHESIS_PROVIDER_ORDER, preferredProvider);
}

export function getCheapStepProductionRoute(): CoachingStepRoute[] {
  return CHEAP_STEP_PROVIDER_ORDER.map((provider) => routeFor(provider, "fast"));
}

export function getFinalModeratorProductionRoute(): CoachingStepRoute[] {
  return getPremiumSynthesisProviderOrder().map((provider) => routeFor(provider, "main"));
}

export function getTestRoute(): CoachingStepRoute[] {
  return CHEAP_STEP_PROVIDER_ORDER.map((provider) => routeFor(provider, "fast"));
}

export const CHEAP_STEP_PRODUCTION_ROUTE: readonly CoachingStepRoute[] =
  getCheapStepProductionRoute();

export const FINAL_MODERATOR_PRODUCTION_ROUTE: readonly CoachingStepRoute[] =
  getFinalModeratorProductionRoute();

export const TEST_ROUTE: readonly CoachingStepRoute[] = getTestRoute();

export function getRoutesForStep(
  step: CoachingStepId,
  mode: CoachingOrchestrationMode,
): readonly CoachingStepRoute[] {
  if (mode === "test") {
    return getTestRoute();
  }

  return step === FINAL_MODERATOR_STEP
    ? getFinalModeratorProductionRoute()
    : getCheapStepProductionRoute();
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
