import type { Provider } from '../types';
import type { CommandOptions, Config } from '../types';
import type { BaseModelProvider } from '../providers/base';
import { defaultMaxTokens } from '../config';

interface ProviderInfo {
  provider: Provider;
  available: boolean;
  defaultModel?: string;
}

// Default models for each provider when none specified in config
const DEFAULT_MODELS: Record<Provider, string> = {
  perplexity: 'sonar-pro',
  gemini: 'gemini-2.5-pro',
  openai: 'gpt-4.1', // largest context window (1M tokens) so best chance of working
  anthropic: 'claude-sonnet-4-20250514',
  openrouter: 'google/gemini-2.5-pro', // largest context window (1M tokens) so best chance of working
  modelbox: 'google/gemini-2.5-pro', // largest context window (1M tokens) so best chance of working
  xai: 'grok-4-latest',
  groq: 'moonshotai/kimi-k2-instruct',
};

// Provider preference order for each command type
export const PROVIDER_PREFERENCE: Record<string, Provider[]> = {
  web: ['perplexity', 'gemini', 'modelbox', 'openrouter', 'xai', 'groq'],
  repo: ['gemini', 'modelbox', 'openrouter', 'openai', 'perplexity', 'anthropic', 'xai', 'groq'],
  plan_file: [
    'gemini',
    'modelbox',
    'openrouter',
    'openai',
    'perplexity',
    'xai',
    'anthropic',
    'groq',
  ],
  plan_thinking: [
    'openai',
    'anthropic',
    'gemini',
    'xai',
    'groq',
    'openrouter',
    'modelbox',
    'perplexity',
  ],
  doc: ['gemini', 'openai', 'modelbox', 'openrouter', 'perplexity', 'xai', 'anthropic', 'groq'],
  ask: ['openai', 'modelbox', 'openrouter', 'gemini', 'xai', 'anthropic', 'perplexity', 'groq'],
  browser: ['anthropic', 'openai', 'gemini'],
};

export function getDefaultModel(provider: Provider): string {
  return DEFAULT_MODELS[provider];
}

export function getAllProviders(): ProviderInfo[] {
  return [
    {
      provider: 'perplexity',
      available: !!process.env.PERPLEXITY_API_KEY,
      defaultModel: DEFAULT_MODELS.perplexity,
    },
    {
      provider: 'gemini',
      available: !!process.env.GEMINI_API_KEY,
      defaultModel: DEFAULT_MODELS.gemini,
    },
    {
      provider: 'openai',
      available: !!process.env.OPENAI_API_KEY,
      defaultModel: DEFAULT_MODELS.openai,
    },
    {
      provider: 'anthropic',
      available: !!process.env.ANTHROPIC_API_KEY,
      defaultModel: DEFAULT_MODELS.anthropic,
    },
    {
      provider: 'openrouter',
      available: !!process.env.OPENROUTER_API_KEY,
      defaultModel: DEFAULT_MODELS.openrouter,
    },
    {
      provider: 'modelbox',
      available: !!process.env.MODELBOX_API_KEY,
      defaultModel: DEFAULT_MODELS.modelbox,
    },
    {
      provider: 'xai',
      available: !!process.env.XAI_API_KEY,
      defaultModel: DEFAULT_MODELS.xai,
    },
    {
      provider: 'groq',
      available: !!process.env.GROQ_API_KEY,
      defaultModel: DEFAULT_MODELS.groq,
    },
  ];
}

export function getProviderInfo(provider: string): ProviderInfo | undefined {
  return getAllProviders().find((p) => p.provider === provider);
}

export function isProviderAvailable(provider: string): boolean {
  return !!getProviderInfo(provider)?.available;
}

export function getAvailableProviders(): ProviderInfo[] {
  return getAllProviders().filter((p) => p.available);
}

export function getNextAvailableProvider(
  commandType: keyof typeof PROVIDER_PREFERENCE,
  currentProvider?: Provider
): Provider | undefined {
  const preferenceOrder = PROVIDER_PREFERENCE[commandType];
  if (!preferenceOrder) {
    throw new Error(`Unknown command type: ${commandType}`);
  }

  const availableProviders = getAllProviders();

  // If currentProvider is specified, start looking from the next provider in the preference order
  const startIndex = currentProvider ? preferenceOrder.indexOf(currentProvider) + 1 : 0;

  // Look through remaining providers in preference order
  for (let i = startIndex; i < preferenceOrder.length; i++) {
    const provider = preferenceOrder[i];
    const providerInfo = availableProviders.find((p) => p.provider === provider);
    if (providerInfo?.available) {
      return provider;
    } else {
      console.log(`Provider ${provider} is not available`);
    }
  }

  return undefined;
}

export function resolveMaxTokens(
  options: CommandOptions | undefined,
  config: Config,
  providerName: Provider,
  providerInstance: BaseModelProvider,
  commandName: 'ask' | 'repo' | 'doc' | 'plan' | 'web',
  configKey: 'maxTokens' | 'fileMaxTokens' | 'thinkingMaxTokens' = 'maxTokens'
): number {
  const commandConfig = config[commandName as keyof Config] as
    | { [key: string]: number | undefined }
    | undefined;

  return (
    options?.maxTokens ||
    (commandConfig && commandConfig[configKey]) ||
    (config as Record<string, any>)[providerName]?.maxTokens ||
    (providerInstance.getDefaultMaxTokens && providerInstance.getDefaultMaxTokens()) ||
    defaultMaxTokens
  );
}
