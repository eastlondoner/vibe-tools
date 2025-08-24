# Ollama Integration: Parallel Implementation Plan (Status Update)

Owners: Engineer A (Provider & Core), Engineer B (CLI & UX)
Target branch: `feat/ollama-provider`
Default model: `gpt-oss:20b` (quantized)
Assumptions: Ollama daemon available at `http://localhost:11434` unless overridden via `OLLAMA_HOST`

## Progress Snapshot
- Provider implemented and factory-wired
- Auto-download on-demand implemented
- CLI command implemented (`list`, `pull`, `status`, plus `install`)
- Config/types updated with `ollama` block and defaults
- Remaining: docs, examples, QA guide, optional helper utilities, tests

## Objectives
- Add an `ollama` provider to vibe-tools with parity to existing providers
- Auto-download models on-demand; list installed and downloadable models
- Use `gpt-oss:20b` as default model; allow override via config/env/CLI
- Provide a minimal `vibe-tools ollama` command for model management (list/pull/status)

## Deliverables
- Source code updates under `src/providers/`, `src/utils/`, `src/commands/`
- Config and types updated to include `ollama`
- Docs updated (`README.md`, `CONFIGURATION.md`)
- Manual test notes and examples

## Out-of-Scope (for this milestone)
- Fine-tuning flows
- Function/tool calling adapters beyond basic chat
- Embeddings API (can be added later)

---

## Workstream A — Provider, Config, and Core Integration (Engineer A)

### A1. Types & Config — Status: Done
- Code:
  - `src/types.ts`: `Provider` includes `"ollama"`; `Config` includes `ollama?: { model?: string; maxTokens?: number; host?: string; autoDownload?: boolean; defaultModels?: string[] }`
  - `src/config.ts`: default `ollama` block present with:
    - `maxTokens: 4096`, `host: 'http://localhost:11434'`, `autoDownload: true`, `defaultModels: ['gpt-oss:20b']`
    - Note: default model selection handled via provider defaults; setting `ollama.model` is optional

Acceptance:
- Type-check passes; default config merged without errors

### A2. Provider Implementation — Status: Done
- Implemented inline in `src/providers/base.ts` as `OllamaProvider` (not a separate file)
  - Host resolution: env `OLLAMA_HOST` → config `ollama.host` → fallback `http://localhost:11434`
  - Ensures daemon availability (macOS auto-start best-effort) via `ensureOllamaServer`
  - Auto-downloads missing models via `/api/pull`
  - Lists installed models via `/api/tags`
  - `executePrompt` calls `/api/chat` with `num_predict`
  - `getDefaultMaxTokens()` returns 4096

Acceptance:
- Local run succeeds against a running (or auto-started) Ollama with `gpt-oss:20b`
- Automatic download occurs if model missing, with logs

### A3. Provider Availability & Factory — Status: Done
- Code:
  - `src/providers/base.ts`: `createProvider('ollama')` returns `new OllamaProvider()`
  - `src/utils/providerAvailability.ts`:
    - `DEFAULT_MODELS.ollama = 'gpt-oss:20b'`
    - Provider preference arrays include `ollama`
    - `isOllamaAvailable()` implemented (darwin default true; env hints elsewhere)

Acceptance:
- `createProvider('ollama')` returns an instance
- Provider shows as available per rules above

### A4. Utility Helpers — Status: Partially Done
- Code:
  - `src/utils/ollamaSetup.ts`:
    - `ensureOllamaInstalled()` (macOS: Homebrew; guidance otherwise)
    - `ensureOllamaServer(host)` auto-starts daemon (macOS) and waits for readiness
  - Not implemented (optional helpers proposed earlier): `listInstalledModels()`, `preDownloadModels()` — current flows handle listing via provider and pre-download via CLI `pull`

Acceptance:
- Helpers work with a running daemon; graceful errors otherwise

### A5. Tests (lightweight, manual acceptable) — Status: Pending
- Proposed: `tests/providers/ollama.test.ts` or a manual script covering:
  - not installed, not running, auto-download, prompt flow

Acceptance:
- Test script runs locally, documents expected outputs

### A6. Docs — Status: Pending
- Update `README.md`, `CONFIGURATION.md` with:
  - How to enable and configure Ollama
  - Default model and override options
  - Model auto-download behavior and directory

Acceptance:
- Docs build/render fine; examples copy-pastable

---

## Workstream B — CLI Command, UX, and Examples (Engineer B)

### B1. CLI Command — Status: Done
- Code:
  - `src/commands/ollama.ts` with subcommands:
    - `list` → lists installed models (and suggests popular names)
    - `pull <model>` → downloads model with progress parsing
    - `status` → checks daemon availability and prints guidance
    - `install` → macOS Homebrew install helper with post-checks
  - Registered in `src/commands/index.ts` as `ollama`

Acceptance:
- `pnpm dev ollama list|pull <model>|status|install` works and exits cleanly

### B2. Provider Wiring in Commands — Status: Partially Done
- Code:
  - `src/commands/ask.ts`: default model for `ollama` set to `gpt-oss:20b`; uses common provider factory
  - Shared provider selection/priorities include `ollama` via `providerAvailability`
- To verify:
  - Ensure `repo`, `plan`, `doc`, `web` flows correctly resolve models/maxTokens for `ollama` (they use shared utils but should be QA’d)

Acceptance:
- Commands run with `--provider=ollama` and return content

### B3. Config Surfacing & Examples — Status: Pending
- Extend `CONFIGURATION.md` with `ollama` section and sample snippet
- Example commands for:
  - Setting provider/model via CLI and config
  - Auto-download behavior on first use

Acceptance:
- Examples verified manually

### B4. Manual QA Checklist & Scripts — Status: Pending
- Add `tests/manual/ollama-qa.md` with steps:
  - Fresh system (no models) → run ask with default model (triggers download)
  - Run `vibe-tools ollama list` before/after pull
  - Change host via env and config; verify
  - Failure cases: no daemon, network error, insufficient disk
- Optional: `scripts/check-ollama.ts` to print status and installed models

Acceptance:
- QA steps reproducible by another engineer

### B5. README Enhancements — Status: Pending
- Add “Local Inference via Ollama” section with:
  - Prereqs, install link
  - Quickstart (status, list, pull, ask with provider)
  - Notes on performance and model sizes (link to `local-research/mac-silicon-local-inference-research.md`)

Acceptance:
- Section is concise and actionable

---

## Shared Interfaces & Contracts (Updated)
- Provider key: `"ollama"`
- Default model: `gpt-oss:20b`
- Env vars:
  - `OLLAMA_HOST` (overrides host)
  - `OLLAMA_ENABLED=1` (optional hint to mark available)
- Config (`vibe-tools.config.json`):
```json
{
  "ollama": {
    "model": "gpt-oss:20b",
    "maxTokens": 4096,
    "host": "http://localhost:11434",
    "autoDownload": true,
    "defaultModels": ["gpt-oss:20b", "llama3.3"]
  }
}
```
- CLI command name: `vibe-tools ollama`
- Logging: use `console.log` for meta info, `console.error` for errors, and `yield` in command streams

---

## Parallelization & Merge Strategy
- Current state allows both engineers to proceed on remaining docs/tests/QA in parallel
- Suggested next merges:
  1) B5 README + A6 CONFIGURATION docs
  2) B4 QA guide + smoke scripts
  3) A5 tests (or manual validation script) and any polish

---

## Acceptance Criteria (End-to-End)
- `pnpm dev ask "Hello" --provider=ollama` returns a response
- When `gpt-oss:20b` missing, first run auto-downloads and then answers
- `pnpm dev ollama status` reports running/not running accurately
- `pnpm dev ollama list` shows installed models
- `pnpm dev ollama pull mistral` downloads with progress
- Config and env overrides are respected
- Documentation updated; manual QA doc included

## Risks & Mitigations
- Ollama not installed/running → clear guidance and links; friendly errors; `install` subcommand provided
- Large downloads/timeouts → progress output and retry guidance
- Model name mismatches → maintain small known list; surface backend errors clearly
- Token limits/perf → conservative defaults; document expectations

## Time Estimate (Remaining)
- Docs & examples (A6, B5): ~0.5–1 day
- QA guide & scripts (B4): ~0.5 day
- Tests (A5): ~0.5 day
- Buffer/polish: ~0.5 day

Total remaining: ~2–2.5 days with parallel execution.
