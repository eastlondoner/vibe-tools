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
  openai: 'gpt-5', // largest context window (1M tokens) so best chance of working
  anthropic: 'claude-sonnet-4-20250514',
  openrouter: 'google/gemini-2.5-pro', // largest context window (1M tokens) so best chance of working
  modelbox: 'google/gemini-2.5-pro', // largest context window (1M tokens) so best chance of working
  xai: 'grok-4-latest',
  groq: 'moonshotai/kimi-k2-instruct',
  cerebras: 'gpt-oss-120b',
  ollama: 'gpt-oss:20b',
};

// Provider preference order for each command type
export const PROVIDER_PREFERENCE: Record<string, Provider[]> = {
  web: ['perplexity', 'anthropic', 'gemini', 'modelbox', 'openrouter', 'xai', 'groq', 'ollama'],
  repo: [
    'gemini',
    'modelbox',
    'openrouter',
    'openai',
    'perplexity',
    'anthropic',
    'xai',
    'groq',
    'cerebras',
    'ollama',
  ],
  plan_file: [
    'gemini',
    'modelbox',
    'openrouter',
    'openai',
    'perplexity',
    'xai',
    'anthropic',
    'groq',
    'cerebras',
    'ollama',
  ],
  plan_thinking: [
    'openai',
    'anthropic',
    'gemini',
    'xai',
    'groq',
    'cerebras',
    'openrouter',
    'modelbox',
    'perplexity',
    'ollama',
  ],
  doc: [
    'gemini',
    'openai',
    'modelbox',
    'openrouter',
    'perplexity',
    'xai',
    'anthropic',
    'groq',
    'cerebras',
    'ollama',
  ],
  ask: [
    'openai',
    'modelbox',
    'openrouter',
    'gemini',
    'xai',
    'anthropic',
    'perplexity',
    'groq',
    'cerebras',
    'ollama',
  ],
  browser: ['anthropic', 'openai', 'gemini', 'xai', 'groq', 'cerebras', 'ollama'],
};

export function getDefaultModel(provider: Provider): string {
  return DEFAULT_MODELS[provider];
}

function isOllamaAvailable(): boolean {
  // On macOS we can auto-install/auto-start, so consider it available by default
  if (process.platform === 'darwin') {
    return true;
  }
  // Otherwise, mark available if explicit hints are set
  return !!(process.env.OLLAMA_HOST || process.env.OLLAMA_ENABLED);
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
    {
      provider: 'cerebras',
      available: !!process.env.CEREBRAS_API_KEY,
      defaultModel: DEFAULT_MODELS.cerebras,
    },
    {
      provider: 'ollama',
      available: isOllamaAvailable(),
      defaultModel: DEFAULT_MODELS.ollama,
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
