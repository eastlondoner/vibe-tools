--- Implementation Plan ---
# Design & Implementation Plan
Add automatic support for Anthropic's new 1 M-token context window for the **repo** and **plan** commands.

---

## Phase 0 – Background & Decisions

| Topic | Decision |
|-------|----------|
| Supported models | Only `claude-sonnet-4-20250514` (and any future `claude-sonnet-4-*`) .|
| Opt-in mechanism | Pass `betas: ['context-1m-2025-08-07']` in the top-level call to `anthropic.messages.create`. |
| When to opt-in | Whenever `ModelOptions.tokenCount > 200 000` **and** the resolved model is a Sonnet-4 variant. |
| Max context cap | Hard cap at **1 000 000** tokens. Over that we still throw the "repository too large" error. |
| Output tokens | Still governed by `maxTokens`; no change required. |
| Location of logic | All changes live inside `src/providers/base.ts` (AnthropicProvider) so commands remain unchanged. |
| Backwards compatibility | Existing 200 k-token behaviour unchanged; other Claude models still limited to 200 k. |

---

## Phase 1 – Update AnthropicProvider limits & beta flag

### Files
- `src/providers/base.ts`  (AnthropicProvider class only)

### Steps
1. **Bump limit**
   Replace the hard-coded `limit = 200_000` with logic:

   ```ts
   const CLAUDE_SONNET_4_MAX = 1_000_000;
   const DEFAULT_LIMIT      = 200_000;
   const isSonnet4 = (m: string) =>
     m.includes('claude-sonnet-4');

   // inside handleLargeTokenCount
   const limit = isSonnet4(this.pendingModelName ?? '')
       ? CLAUDE_SONNET_4_MAX
       : DEFAULT_LIMIT;
   ```

2. **Remove early-error for Sonnet-4 under 1 M**
   Only return `error:` when `tokenCount > limit`.

3. **Pass beta header automatically**
   In `executePrompt` right before the `messages.create` call:

   ```ts
   if (
     options.tokenCount &&
     options.tokenCount > 200_000 &&
     model.includes('claude-sonnet-4')
   ) {
     // SDK 0.19+ supports betas array
     (requestParams as any).betas = ['context-1m-2025-08-07'];
   }
   ```

4. **Store pending model name**
   Because `handleLargeTokenCount` no longer receives the model name, add a private field `pendingModelName` in AnthropicProvider, set it inside `getModel`, and use it from `handleLargeTokenCount` (cheap refactor, 3-line change).

### Code Sketch

```ts
/* --- src/providers/base.ts --- */
class AnthropicProvider extends BaseProvider {
  /* ... */
  private pendingModelName?: string;           // <— new

  protected async getModel(opts?: ModelOptions): Promise<string> {
    /* existing logic … */
    this.pendingModelName = opts?.model;       // <— remember
    return resolved;
  }

  protected handleLargeTokenCount(tokenCount: number) {
    const isSonnet4 = this.pendingModelName?.includes('claude-sonnet-4');
    const limit = isSonnet4 ? 1_000_000 : 200_000;
    if (tokenCount > limit) {
      return { error: `Repository content (${tokenCount}) exceeds ${limit} token limit.` };
    }
    return {};                                // allow
  }

  async executePrompt(prompt: string, options: ModelOptions): Promise<string> {
    /* existing pre-call setup … */
    const requestParams: any = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    };

    // NEW: opt-in to 1M context when required
    if (
      options.tokenCount &&
      options.tokenCount > 200_000 &&
      model.includes('claude-sonnet-4')
    ) {
      requestParams.betas = ['context-1m-2025-08-07'];
    }

    const response = await this.client.messages.create(requestParams);
    /* ... */
  }
}
```

_No other providers touched._

---

## Phase 2 – Ensure repo / plan commands forward tokenCount (already done)

Both commands already set `options.tokenCount = tokenCount` when the packed repo is larger than `200 000`.
No change required, but we should **update the warning message** that currently says "too large (>200k)".

### Files
- `src/commands/repo.ts`
- `src/commands/plan.ts`

### Steps
1. Find any human-facing messages mentioning the 200 k limit; change to "200 k for most models, 1 M for Claude Sonnet 4".
   Extremely small textual diff; no logic change.

---

## Phase 3 – Update docs & defaults

### Files
- `CONFIGURATION.md`
- `README.md`
- `local-research/anthropic-1m-context-research.md` (already explains header, ensure wording matches)

### Steps
1. Add note under Anthropic in configuration guide:
   "`claude-sonnet-4-20250514` now supports a 1 M token context window automatically when repo/plan needs it. vibe-tools adds the required beta header for you; no manual change needed."
2. Mention tier-4 requirement and higher cost.

_No code impact._

---

## Phase 4 – Smoke test & manual QA

1. Create or use a repo packed by Repomix with ~400 k tokens.
2. Run:

   ```bash
   vibe-tools repo "Give me an overview" --provider anthropic
   ```

   ‑ Expect no "too large" error, model call succeeds, and server logs show `betas: [ 'context-1m-2025-08-07' ]`.

3. Repeat with 1.1 M tokens → still get the size error.

4. Run regular small repo => no beta header sent (inspecting debug logs).

---

## Phase 5 – Future-proofing (optional, no immediate code)

Put the beta header key (`BETA_1M_CONTEXT_HEADER`) in a small util constant so we can update when Anthropic changes the string.

---

### Summary of Files Touched

| Phase | File(s) | Change Type |
|-------|---------|-------------|
| 1 | `src/providers/base.ts` (AnthropicProvider) | ⚙️ logic & new beta header |
| 2 | `src/commands/repo.ts`, `src/commands/plan.ts` | 📝 message wording |
| 3 | `CONFIGURATION.md`, `README.md` | 📖 docs |

---

## Done

After these steps, vibe-tools will transparently upgrade Anthropic Sonnet 4 calls to the 1 M-token beta whenever repo or plan needs it, while preserving existing behaviour for all other cases.
--- End Plan ---

