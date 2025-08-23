import { z } from 'zod';

// Flexible model validation function to support all Stagehand providers
export function isValidStagehandModel(model: string): boolean {
  // Allow either provider/model format or standalone model names
  return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(model) || /^[a-zA-Z0-9._-]+$/.test(model);
}

// Use flexible validation instead of restrictive enum
export const availableModels = z.string().refine(isValidStagehandModel, {
  message: "Model must be in provider/model format (e.g., 'xai/grok-4-latest') or standalone name",
});

export type AvailableModel = z.infer<typeof availableModels>;

export interface StagehandConfig {
  provider: 'anthropic' | 'openai' | 'gemini' | 'xai' | 'groq' | 'cerebras';
  headless: boolean;
  verbose: boolean;
  debugDom: boolean;
  enableCaching: boolean;
  timeout?: number;
  model?: string;
}

interface BrowserConfig {
  headless?: boolean;
  defaultViewport?: string;
  timeout?: number;
  stagehand?: {
    provider?: string;
    headless?: boolean;
    verbose?: boolean;
    debugDom?: boolean;
    enableCaching?: boolean;
    timeout?: number;
    model?: string;
  };
}

interface Config {
  browser?: BrowserConfig;
}

export function loadStagehandConfig(config: Config): StagehandConfig {
  const browserConfig = config.browser || {};
  const stagehandConfig = browserConfig.stagehand || {};

  // Set default values
  const headless = stagehandConfig.headless ?? true;
  const verbose = stagehandConfig.verbose ?? false;
  const debugDom = stagehandConfig.debugDom ?? false;
  const enableCaching = stagehandConfig.enableCaching ?? false;
  const timeout = stagehandConfig.timeout ?? 120000;
  let provider = stagehandConfig.provider?.toLowerCase() as StagehandConfig['provider'];

  // Define all supported providers for easy reference
  const supportedProviders: StagehandConfig['provider'][] = [
    'anthropic',
    'openai',
    'gemini',
    'xai',
    'groq',
    'cerebras',
  ];

  if (!provider) {
    // Set provider based on available API keys in preference order
    const providerKeys: Array<{ provider: StagehandConfig['provider']; key: string }> = [
      { provider: 'anthropic', key: 'ANTHROPIC_API_KEY' },
      { provider: 'openai', key: 'OPENAI_API_KEY' },
      { provider: 'gemini', key: 'GEMINI_API_KEY' },
      { provider: 'xai', key: 'XAI_API_KEY' },
      { provider: 'groq', key: 'GROQ_API_KEY' },
      { provider: 'cerebras', key: 'CEREBRAS_API_KEY' },
    ];

    for (const { provider: p, key } of providerKeys) {
      if (process.env[key]) {
        provider = p;
        if (p !== 'anthropic') {
          console.log(`Defaulting to ${p} as AI provider for Stagehand`);
        }
        break;
      }
    }

    if (!provider) {
      throw new Error(
        'No supported API key found for Stagehand. Please set one of the following in your environment or ~/.vibe-tools/.env file:\n' +
          providerKeys.map(({ key }) => `  - ${key}`).join('\n')
      );
    }
  } else {
    // Validate that the specified provider is supported
    if (!supportedProviders.includes(provider)) {
      throw new Error(
        `Unrecognized AI provider "${provider}" for Stagehand. Supported providers are:\n` +
          supportedProviders.join(', ')
      );
    }

    // Validate that the API key exists for the specified provider
    try {
      getStagehandApiKey({ provider });
    } catch (error) {
      console.error('error getting API key for stagehand provider', provider, error);
      throw error; // Re-throw with the specific error message from getStagehandApiKey
    }
  }

  return {
    provider,
    headless,
    verbose,
    debugDom,
    enableCaching,
    timeout,
    model: stagehandConfig.model,
  };
}

export function validateStagehandConfig(config: StagehandConfig): void {
  if (!config) {
    throw new Error('Stagehand configuration is missing');
  }

  // Validate that the provider is supported
  const supportedProviders: StagehandConfig['provider'][] = [
    'anthropic',
    'openai',
    'gemini',
    'xai',
    'groq',
    'cerebras',
  ];

  if (!config.provider || !supportedProviders.includes(config.provider)) {
    throw new Error(
      `Invalid Stagehand provider "${config.provider}". Supported providers are:\n` +
        supportedProviders.join(', ')
    );
  }

  // Check for required API key using the unified getStagehandApiKey function
  try {
    getStagehandApiKey(config);
  } catch (error) {
    console.error('error validating stagehand config', config, error);
    throw error; // Re-throw with the specific error message from getStagehandApiKey
  }
}

export function getStagehandApiKey(config: Pick<StagehandConfig, 'provider'>): string {
  const keyMap: Record<StagehandConfig['provider'], string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    xai: 'XAI_API_KEY',
    groq: 'GROQ_API_KEY',
    cerebras: 'CEREBRAS_API_KEY',
  };

  const envVar = keyMap[config.provider];
  const apiKey = process.env[envVar];

  if (!apiKey) {
    throw new Error(
      `${envVar} is required for Stagehand ${config.provider} provider. ` +
        `Please set it in your .vibe-tools.env file.`
    );
  }

  return apiKey;
}

/**
 * Get the Stagehand model to use based on the following precedence:
 * 1. Command line option (--model)
 * 2. Configuration file (vibe-tools.config.json)
 * 3. Default model based on provider (claude-sonnet-4-20250514 for Anthropic, o3-mini for OpenAI)
 *
 * If both command line and config models are invalid, falls back to the default model for the provider.
 *
 * @param config The Stagehand configuration
 * @param options Optional command line options
 * @returns The model to use
 */
export function getStagehandModel(
  config: StagehandConfig,
  options?: { model: string | undefined; provider: StagehandConfig['provider'] | undefined }
): AvailableModel {
  // If a model is specified (via command line or config), validate and use it
  const modelToUse = options?.model ?? config.model;
  if (modelToUse) {
    const parseAttempt = availableModels.safeParse(modelToUse);
    if (parseAttempt.success) {
      return parseAttempt.data;
    }
    console.warn(
      `Warning: Using unfamiliar model "${modelToUse}" this may be a mistake. ` +
        `Typical models are "claude-3-7-sonnet-latest" for Anthropic and "o3-mini" or "gpt-4o" for OpenAI.`
    );

    if (!modelToUse.includes('/')) {
      const provider = config.provider;
      return `${provider}/${modelToUse}` as AvailableModel;
    }
    return modelToUse as AvailableModel;
  }

  // Default models for all supported providers
  const DEFAULT_MODELS: Record<StagehandConfig['provider'], string> = {
    anthropic: 'anthropic/claude-sonnet-4-20250514',
    openai: 'openai/gpt-5',
    gemini: 'google/gemini-2.5-flash',
    xai: 'xai/grok-4-latest',
    groq: 'groq/moonshotai/kimi-k2-instruct',
    cerebras: 'cerebras/gpt-oss-120b',
  };

  // Otherwise use defaults based on provider
  const provider = options?.provider ?? config.provider;
  const defaultModel = DEFAULT_MODELS[provider];

  if (!defaultModel) {
    throw new Error(`No default model configured for provider "${provider}"`);
  }

  return defaultModel;
}
