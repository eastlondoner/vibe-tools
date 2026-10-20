# Feature Behavior: Parallel Web Search

## Description

Manually verify anonymous search and page fetching through the web command.
Use an isolated directory and home without vibe-tools configuration or credentials
for the unconfigured scenario. Source excerpts are returned to the calling agent;
Parallel does not synthesize an answer using an LLM.

## Test Scenarios

### Scenario 1: Fresh installation

**Task Description:**
Run `vibe-tools web "Node.js release schedule"` with no provider keys or saved settings.

**Expected Behavior:**
The command returns source excerpts and URLs from Parallel without an API key.

**Success Criteria:**
The caller can read useful search content, and `--save-to` preserves that content.

### Scenario 2: Explicit selection and page fetching

**Task Description:**
Run `vibe-tools web "Supported versions" --provider parallel --url https://nodejs.org/en/about/previous-releases`.

**Expected Behavior:**
The command fetches page excerpts even when another provider has credentials.

**Success Criteria:**
Output contains page content and the source URL. `--timeout` bounds discovery and execution.

### Scenario 3: Preserve choices and surface failures

**Task Description:**
Select Perplexity through `--provider` and through saved `web.provider`, without its key.
Repeat with an explicit model and no credentials, a non-HTTP page URL, an empty query,
a short timeout, and an aborted programmatic request. Disable web search through
`webSearch: false`. Exercise a server tool error and a network failure.

**Expected Behavior:**
Invalid inputs, disabled search and unavailable choices fail visibly. No failure
silently switches to Parallel or retries. Parallel rejects model/token options.

**Success Criteria:**
Disabled/invalid requests do not make network calls. Cancellation and timeout close
the MCP connection. Independent and concurrent command executions use separate
opaque research session IDs; a command never derives an ID from the user's query.
