# Vibe Tools Telemetry

This document describes the telemetry system used by Vibe Tools, covering the infrastructure, data structure, data flow/pipeline, and privacy considerations.

## Overview

The telemetry infrastructure for `vibe-tools` is designed to collect anonymous usage data to help improve the tool. It involves:

1. Client-side data collection within the `vibe-tools` CLI
2. A Cloudflare Worker acting as an ingestion endpoint
3. A Cloudflare Pipeline for data processing and batching
4. Cloudflare R2 for final storage

## 1. Data Collection (Client-Side)

Telemetry collection happens in `src/telemetry/index.ts`.

### What is collected

The `CommandState` interface defines the core data points:
- **command**: The `vibe-tools` command executed (e.g., `repo`, `web`, `plan`)
- **startTime**: Timestamp when the command started
- **Token counts**: `tokenCount` (overall context tokens), `promptTokens`, `completionTokens`
- **AI Model details**: `provider` (e.g., `gemini`, `openai`), `model` name
- **Plan command specific**: `fileProvider`, `fileModel`, `thinkingProvider`, `thinkingModel`
- **options**: Sanitized command-line options used (e.g., `--debug`, `--saveTo`, but not sensitive values)
- **error**: If an error occurred, its `type` (constructor name) and `message` are recorded

### What is NOT collected

The `TELEMETRY_DATA_DESCRIPTION` explicitly states that the following are **not** tracked:
- User queries
- Prompts
- File contents
- Code
- Personal data
- API keys

### User Identification

- A `userId` is generated (UUID) and stored in `~/.vibe-tools/diagnostics.json`
- If telemetry is disabled, `userId` can be `anonymous_opt_out` or `anonymous_pending_prompt`
- A `sessionId` (UUID) is generated for each CLI invocation

### Telemetry Control

- Users can opt-out via the `VIBE_TOOLS_NO_TELEMETRY=1` environment variable
- During `vibe-tools install`, users are prompted to enable/disable telemetry, with the choice stored in `~/.vibe-tools/diagnostics.json`

### Collection Process

1. `startCommand(command, options)`: Initializes `currentCommandState` when a command begins
2. `updateCommandState(update)`: Allows updating the state with information like token counts as the command progresses
3. `recordError(error)`: Captures error details if a command fails
4. `endCommand()`: Calculates duration, finalizes the payload, and calls `trackEvent`
5. `trackEvent(eventName, properties)`:
   - Constructs the final JSON payload
   - Sends an HTTP POST request to the `TELEMETRY_ENDPOINT`

## 2. Telemetry Data Structure

The JSON payload sent by the client has the following structure:

```json
{
  "data": {
    "eventName": "command_executed" | "command_error", // Type of event
    "userId": "string",         // User's unique identifier (or anonymous placeholder)
    "sessionId": "string",      // Unique ID for the current CLI session
    "timestamp": "ISO8601_string", // Time of the event
    "toolVersion": "string",    // Version of vibe-tools
    // --- Additional properties from CommandState ---
    "command": "string",
    "duration": "number_milliseconds",
    "contextTokens": "number_optional",
    "promptTokens": "number_optional",
    "completionTokens": "number_optional",
    "provider": "string_optional",
    "model": "string_optional",
    "fileProvider": "string_optional",    // Specific to 'plan' command
    "fileModel": "string_optional",       // Specific to 'plan' command
    "thinkingProvider": "string_optional",// Specific to 'plan' command
    "thinkingModel": "string_optional",   // Specific to 'plan' command
    "options": { /* sanitized key-value pairs */ },
    "hasError": "boolean",
    "errorType": "string_optional"      // e.g., "ProviderError", "FileError"
  }
}
```

## 3. Infrastructure Setup

The infrastructure is provisioned using Alchemy for Cloudflare. The key configuration is in `infra/alchemy/alchemy.run.ts`.

### Cloudflare Worker (`vibe-tools-infra`)

- Acts as the ingestion endpoint for telemetry data
- The entry point is `infra/app/index.ts`
- Requests to `/api/pipeline` are handled by a Nuxt server route defined in `infra/server/api/pipeline.post.ts`
- This route receives the JSON payload from the `vibe-tools` CLI

### Cloudflare Pipeline (`vibe-tools-telemetry`)

- **Source**: Configured with a `binding` source, receiving data pushed by the Cloudflare Worker
- **Processing**: Batches incoming JSON data based on:
  - Size (max 10MB)
  - Time (max 5 seconds)
  - Row count (max 100 rows)
- **Destination**: The R2 bucket

### Cloudflare R2 Bucket (`vibe-tools-telemetry`)

- Final storage for the batched telemetry data
- Data is stored in JSON format

### API Token (`telemetry-pipeline-r2-access-token`)

- An account-level API token with `Workers R2 Storage Bucket Item Write` permissions
- Used by the Cloudflare Pipeline to write data to R2

### Dynamic Endpoint Update

- The `alchemy.run.ts` script updates the `TELEMETRY_ENDPOINT` constant in `src/telemetry/index.ts` after deploying the worker
- It sets the endpoint to the live URL of the deployed worker's API endpoint (e.g., `https://vibe-tools-infra.aejefferson.workers.dev/api/pipeline`)

## 4. Data Flow / Pipeline

1. **Collection**: `vibe-tools` CLI gathers telemetry data during command execution
2. **Transmission**: Upon command completion (or error), `endCommand()` calls `trackEvent()`, which sends an HTTP POST request with the JSON payload to the `TELEMETRY_ENDPOINT`
3. **Ingestion**: The Cloudflare Worker receives the request
   - It reads the request body
   - It extracts the `data` object from the payload
   - It sends this `data` object, wrapped in an array (`[data]`), to its bound Cloudflare Pipeline
4. **Processing & Batching**: The Cloudflare Pipeline batches the data according to its configuration
5. **Storage**: Once a batch is ready, the Pipeline writes the batch of JSON objects to the `vibe-tools-telemetry` R2 bucket

### Visual Representation

```
┌─────────────────┐     HTTP POST     ┌─────────────────────┐
│                 │    JSON Payload    │                     │
│  vibe-tools CLI ├───────────────────►  Cloudflare Worker  │
│                 │                    │                     │
└─────────────────┘                    └─────────┬───────────┘
                                                 │
                                                 │ pipeline.send([data])
                                                 ▼
                                       ┌─────────────────────┐
                                       │                     │
                                       │ Cloudflare Pipeline │
                                       │                     │
                                       └─────────┬───────────┘
                                                 │
                                                 │ Batch writes
                                                 ▼
                                       ┌─────────────────────┐
                                       │                     │
                                       │   Cloudflare R2     │
                                       │                     │
                                       └─────────────────────┘
```

## 5. Privacy Considerations

- **Anonymity**: `userId` is designed to be anonymous. Opting out or pending prompt results in placeholder IDs
- **Opt-out**: Users can disable telemetry via environment variable (`VIBE_TOOLS_NO_TELEMETRY`) or through the interactive installer
- **Data Minimization**: The system collects only specific, non-sensitive data points
- **Sanitization**: The `sanitizeOptions` function ensures that only a whitelist of command-line option keys are tracked
- **Transparency**: The `TELEMETRY_DATA_DESCRIPTION` details what is and isn't collected

## 6. Data Analysis

Based on the current implementation, the telemetry system focuses primarily on data collection and storage. There are no built-in tools or systems within this repository for analyzing the telemetry data after it's stored in the R2 bucket.

The data is structured in JSON format and stored in batches in the Cloudflare R2 bucket, which makes it suitable for:

1. **Manual Analysis**: Downloading the stored JSON files for analysis using data analysis tools
2. **Custom Tooling**: Building custom analysis tools that read directly from the R2 bucket
3. **BI Integration**: Integrating with business intelligence platforms by exporting data from R2

For implementing a data analysis solution, one approach would be to:
1. Create a scheduled job to process data from R2
2. Transform and load the data into a database or data warehouse
3. Build dashboards or reporting tools on top of the processed data

## Key Files

- `src/telemetry/index.ts` - Client-side telemetry collection
- `infra/alchemy/alchemy.run.ts` - Infrastructure provisioning
- `infra/server/api/pipeline.post.ts` - Telemetry ingestion endpoint
- `infra/app/index.ts` - Cloudflare Worker entry point
- `infra/env.ts` - Environment configuration 