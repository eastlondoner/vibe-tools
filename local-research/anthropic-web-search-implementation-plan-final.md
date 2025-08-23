## Implementation Plan: Add Anthropic Built‑in Web Search to vibe-tools

### Overview
This plan merges the strongest ideas from the three drafts to add Anthropic’s built‑in web search across vibe-tools. It enables Claude models to perform real-time web research with citations, domain controls, and localization. The integration works in the `web` command and when `--web` is passed to other commands that support web context.

### Goals and Scope
- Enable Anthropic as a web search provider in the `web` command.
- Honor `--web` across supported commands with Anthropic provider.
- Include citations and handle multi-step, agentic searches.
- Support configuration for domain allow/block, localization, and max sequential searches.
- Provide clear UX, telemetry, and robust error handling.

---

## Phase 1 — Provider Core: Anthropic web search

### Files
- `src/providers/base.ts`

### Changes
1) supportsWebSearch
- Return `supported: true` for Anthropic models that support web search (e.g., Claude 3.5 Haiku/Sonnet, Claude 3.7 Sonnet, Sonnet 4 20250514 variants). Fallback: if `--web` is explicitly requested, treat as supported to avoid blocking; emit a friendly warning if an unexpected model is used.

```ts
// Inside AnthropicProvider
async supportsWebSearch(modelName: string): Promise<{ supported: boolean; model?: string; error?: string }> {
  const webSearchModels = [
    'claude-3-5-haiku',
    'claude-3-5-sonnet',
    'claude-3-7-sonnet',
    'claude-sonnet-4-20250514',
  ];
  const normalized = (modelName || '').toLowerCase();
  const supported = webSearchModels.some((m) => normalized.includes(m));
  return supported ? { supported: true } : { supported: false, error: `Model ${modelName} may not support web search` };
}
```

2) webSearchParameters helper
- Build Anthropic “web search” tool configuration from `config.anthropic.webSearch`.

```ts
// Inside AnthropicProvider
protected buildWebSearchTools(existing: Record<string, any>): Record<string, any> {
  const cfg = (this.config.anthropic as any)?.webSearch || {};
  const tool = {
    type: 'web_search',
    web_search: {
      max_uses: cfg.maxUses ?? 5,
      ...(cfg.allowedDomains ? { allowed_domains: cfg.allowedDomains } : {}),
      ...(cfg.blockedDomains ? { blocked_domains: cfg.blockedDomains } : {}),
      ...(cfg.localization ? { localization: cfg.localization } : {}),
    },
  };
  return {
    ...existing,
    tools: [...(existing.tools || []), tool],
  };
}
```

3) executePrompt enhancements
- If `options.webSearch` is true, add the web search tool using `buildWebSearchTools`.
- Prefer streaming (`client.beta.messages.stream`) for long-running research; fallback to non-streaming if needed.
- Append citations to the final text when present.

```ts
// Inside AnthropicProvider.executePrompt
let params: any = {
  model,
  max_tokens: options.maxTokens,
  system: this.getSystemPrompt(options),
  messages: [{ role: 'user' as const, content: prompt }],
};

if (options.webSearch) {
  params = this.buildWebSearchTools(params);
  if (options.debug) {
    console.log('[AnthropicProvider] Web search enabled:', params.tools?.find((t: any) => t.type === 'web_search'));
  }
}

// Prefer streaming to avoid long-request timeouts
try {
  const stream = await this.client.beta.messages.stream(params);
  let text = '';
  const citations: string[] = [];
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
      text += chunk.delta.text || '';
    }
    // If SDK exposes citation events, collect them here as they arrive
    if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'citation_delta') {
      if (chunk.delta.citation) citations.push(chunk.delta.citation);
    }
  }
  if (citations.length) {
    text += '\n\nCitations:\n' + citations.map((c, i) => `[${i + 1}] ${c}`).join('\n');
  }
  return text;
} catch (e) {
  // Fallback to non-streaming if needed
  const resp = await this.client.beta.messages.create(params);
  const content = this.extractTextFromResponse(resp);
  const citations = this.extractCitationsFromResponse(resp);
  return citations?.length ? `${content}\n\nCitations:\n${citations.map((c, i) => `[${i + 1}] ${c}`).join('\n')}` : content;
}
```

Notes
- Keep existing 1M context beta header logic intact.
- Reuse existing token accounting and telemetry hooks.

---

## Phase 2 — Web command: enable Anthropic

### Files
- `src/commands/web.ts`

### Changes
- Update `DEFAULT_WEB_MODELS` to enable Anthropic by default when selected for web search.

```ts
// src/commands/web.ts
const DEFAULT_WEB_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.5-pro',
  openai: 'NO WEB SUPPORT',
  perplexity: 'sonar-pro',
  openrouter: 'google/gemini-2.5-pro',
  modelbox: 'google/gemini-2.5-pro',
  xai: 'grok-4-latest',
  anthropic: 'claude-sonnet-4-20250514', // now supports web search
  groq: 'NO WEB SUPPORT',
  cerebras: 'NO WEB SUPPORT',
};
```

---

## Phase 3 — Configuration and Types

### Files
- `src/types.ts`
- `src/config.ts`
- `CONFIGURATION.md`
- `vibe-tools.config.json`

### Changes
1) Extend config types

```ts
// src/types.ts
export interface Config {
  // ...existing fields...
  anthropic?: {
    model?: string;
    maxTokens?: number;
    webSearch?: {
      maxUses?: number;            // default 5
      allowedDomains?: string[];   // restrict sources
      blockedDomains?: string[];   // exclude sources
      localization?: string;       // e.g., "en-US"
      pricingTier?: string;        // reserved for future pricing controls
    };
  };
}
```

2) Document settings

Add to `CONFIGURATION.md`:

```json
{
  "anthropic": {
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 21000,
    "webSearch": {
      "maxUses": 5,
      "allowedDomains": ["example.com", "docs.example.com"],
      "blockedDomains": ["untrusted.com"],
      "localization": "en-US"
    }
  }
}
```

3) Sample project config (`vibe-tools.config.json`)

```json
{
  "anthropic": {
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 21000,
    "webSearch": {
      "maxUses": 5,
      "allowedDomains": ["example.com", "trustedsite.org"],
      "blockedDomains": ["untrusted.com"],
      "localization": "en-US",
      "pricingTier": "pro"
    }
  },
  "web": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 21000
  }
}
```

---

## Phase 4 — Command flag propagation and UX

### Files
- `src/index.ts`
- `src/commands/ask.ts`
- `src/commands/repo.ts`
- `src/commands/plan.ts`
- `src/commands/doc.ts`
- `src/telemetry/index.ts`

### Changes
- Ensure `webSearch` option is forwarded in `ModelOptions` to the provider when `--web` is used.
- Optional UX: when `--web` and `provider=anthropic`, yield a short line like "Using web search with Claude…" before responses.
- Telemetry: include `webSearch: true` and `webSearchProvider: 'anthropic_native'` when applicable.

```ts
// src/telemetry/index.ts
if (update.webSearch && update.provider === 'anthropic') {
  (update as any).webSearchProvider = 'anthropic_native';
}
```

---

## Phase 5 — Provider preference and availability

### Files
- `src/utils/providerAvailability.ts`

### Changes
- Include Anthropic in the preference list for web searches (after Perplexity, before Gemini, unless project policy dictates otherwise).

```ts
export const PROVIDER_PREFERENCE: Record<string, Provider[]> = {
  web: ['perplexity', 'anthropic', 'gemini', 'modelbox', 'openrouter', 'xai', 'groq'],
  // ...unchanged elsewhere
};
```

---

## Phase 6 — Error handling

### Files
- `src/errors.ts`
- `src/providers/base.ts`

### Changes
1) Add specific error type for web search

```ts
// src/errors.ts
export class WebSearchError extends ProviderError {
  constructor(provider: Provider, details?: unknown) {
    const message = details instanceof Error ? details.message : String(details ?? 'unknown error');
    super(`Web search error with ${provider}: ${message}`, details);
    this.name = 'WebSearchError';
  }
}
```

2) Map Anthropic/API errors to WebSearchError when appropriate (rate limits, access, domain policy, etc.).

```ts
// In AnthropicProvider.executePrompt catch paths
if (e instanceof Error && /web[_-]?search|rate[_-]?limit/i.test(e.message)) {
  throw new WebSearchError(this.provider, e);
}
```

---

## Phase 7 — Testing and QA

### Files
- `tests/feature-behaviors/web/anthropic-web-search-tests.md` (new)

### Scenarios
- Basic: `vibe-tools web "latest AI news" --provider anthropic` → up-to-date info with citations.
- Domain allow list: configure `allowedDomains`, verify only those sources appear.
- Multi-search: complex comparative query, confirm comprehensive answer and citations.
- Localization: set `localization: "fr-FR"`, verify French sources/content trend.
- Error: missing API key and rate limit surfaces clear errors with remediation hints.

### Manual QA checklist
- `web` command works with Anthropic, shows citations.
- `--web` flows through `repo`, `plan`, `doc`, `ask` with Anthropic.
- Debug shows injected web search tool config.
- Telemetry records `webSearch` and provider.

---

## Phase 8 — Release notes and docs

### Files
- `README.md`
- `CONFIGURATION.md`
- `CHANGELOG.md`

### Notes
- Mention Anthropic built‑in web search availability, configuration keys, citation behavior, and pricing notes (e.g., search metering). Link to provider docs.

---

## Summary of File Changes
- `src/providers/base.ts`: supportsWebSearch, buildWebSearchTools, executePrompt streaming + citations.
- `src/commands/web.ts`: enable Anthropic in `DEFAULT_WEB_MODELS`.
- `src/types.ts` and `src/config.ts`: add `anthropic.webSearch` fields.
- `src/telemetry/index.ts`: track `webSearch` + `webSearchProvider`.
- `src/utils/providerAvailability.ts`: add Anthropic to `web` preference order.
- `src/errors.ts`: add `WebSearchError` and map provider errors.
- `tests/feature-behaviors/web/anthropic-web-search-tests.md`: scenarios and manual QA.
- `README.md`, `CONFIGURATION.md`, `CHANGELOG.md`: document feature and usage.

This plan combines the SDK-accurate tool-based approach and streaming from the Anthropic-focused draft with the pragmatic CLI/config/telemetry guidance from the OpenAI-generated draft, producing a cohesive, implementable path forward.


