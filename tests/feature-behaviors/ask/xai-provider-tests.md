# XAI Provider Tests

## Test Scenarios

### Scenario 1: Basic Query Test

**Task Description:**
Ask the question "What is the capital of France?" using vibe-tools with the XAI provider. Rely on the provider’s default model. Do not enable debug mode.

**Expected Behavior:**
- Should use `grok-4-latest` model (default)
- Should return the correct answer (Paris)
- Should display XAI provider usage in debug logs
- Should track token usage

**Success Criteria:**
- The response should contain the correct answer (Paris)
- The response should not contain any citations
- The response should not contain any reasoning effort

### Scenario 2: Model Selection Test

**Task Description:**
Ask "Explain quantum computing" using the XAI provider and explicitly choose the `grok-3-mini-latest` model. Do not enable debug mode.

**Expected Behavior:**
- Should use the specified `grok-3-mini-latest` model
- Should return an informative response about quantum computing
- Should show model selection

**Success Criteria:**
- The response should contain relevant information about quantum computing
- The response should not contain any citations

### Scenario 3: Low Reasoning Effort

**Task Description:**
Solve the equation "2x + 5 = 15" using the XAI provider and grok-3-mini-latest` model with a *low* reasoning-effort setting. Enable debug mode to see the request parameters.

**Expected Behavior:**
- Should add `reasoning_effort: "low"` to the request parameters
- Should solve the equation correctly
- Should show reasoning effort in debug logs

**Success Criteria:**
- The response should contain the correct answer (x = 5)
- The response should not contain any citations

### Scenario 4: Invalid Model Test

**Task Description:**
Attempt to ask any simple question (e.g., "Hello") using the XAI provider **but** specify an invalid model name such as `invalid-model`. Observe the failure, capture the error message, and then retry the same question using one of the valid model names suggested by the error message.

**Expected Behavior:**
- First attempt should throw `ModelNotFoundError`
- Error message should list available models
- Second attempt with a valid model should succeed

**Success Criteria:**
- First attempt should throw `ModelNotFoundError`
- Error message should list available models
- Second attempt with a valid model should succeed

### Scenario 5: Missing API Key Test

**Task Description:**
Ensure that the XAI provider correctly handles a missing API key. Simulate the absence of the API key by adding `XAI_API_KEY=` before the vibe-tools command and ask vibe-tools a simple question.

**Expected Behavior:**
- The command should fail with a message explaining that the API key is missing
- The output should provide some guidance on how to fix the issue
- The output can include details of available providers

**Success Criteria:**
- The command should fail
- The output must include the information that "XAI_API_KEY" is missing

### Scenario 6: Web Flag Test

**Task Description:**
Ask for the Tesla stock price at the last market close using the XAI provider with the web flag.

**Expected Behavior:**
- The response should a relevant answer including a stock price
- The response should contain citations with links to the sources used

**Success Criteria:**
- The response must contain a stock price
- The response must contain citations with links to the sources used
- The response must not contain any statements that the model does not have access to up to date information