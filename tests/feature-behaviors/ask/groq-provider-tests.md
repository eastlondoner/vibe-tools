# Feature Behavior: Groq Provider Integration

## Description

Test the groq provider integration with vibe-tools ask command, specifically focusing on the moonshotai/kimi-k2-instruct model. This test plan covers provider-specific behaviors, model-specific features, and error handling scenarios unique to the Groq API.

## Test Scenarios

### Scenario 1: Basic Query with Groq Provider (Happy Path)

**Tags:** groq, happy-path
**Task Description:**
Use vibe-tools to ask a simple question using the groq provider with moonshotai/kimi-k2-instruct.

Query: "Explain the concept of recursion in programming with a simple example"

**Expected Behavior:**
- The AI agent should correctly use the ask command with groq provider and moonshotai/kimi-k2-instruct model
- The response should include a clear explanation of recursion with a code example
- The command should complete successfully within the Groq API's typical response time
- Token usage should be tracked and reported if available from Groq API

**Success Criteria:**
- Command executes with correct syntax: `vibe-tools ask "..." --provider groq --model moonshotai/kimi-k2-instruct`
- Response contains a coherent explanation of recursion
- Response includes at least one code example
- No error messages are displayed
- Command completes within 30 seconds

### Scenario 2: Groq Provider with Missing API Key (Error Handling)

**Tags:** groq, error-handling, api-key
**Task Description:**
Attempt to use vibe-tools ask command with groq provider when GROQ_API_KEY is set to "".

Query: "What is machine learning?"

**Expected Behavior:**
- The command should fail with a clear error message about missing API key
- Error message should specify that GROQ_API_KEY needs to be set
- Error message should guide users to set the key in .vibe-tools.env file
- No partial or corrupted output should be generated

**Success Criteria:**
- AI agent attempts to use groq provider
- Command fails gracefully with ApiKeyMissingError
- Error message mentions "GROQ_API_KEY" specifically
- Error message includes guidance about setting the key in ~/.vibe-tools/.env
- Exit code is non-zero
- No stack trace is shown unless --debug flag is used

### Scenario 3: Groq-Specific Model Not Found (Error Handling)

**Tags:** groq, error-handling, model-errors
**Task Description:**
Attempt to use vibe-tools ask command with groq provider but with an invalid model name that doesn't exist in Groq's model catalog.

Query: "Hello world"

Use model name: "invalid-model-xyz"

**Expected Behavior:**
- The command should fail with a model not found error
- Error message should be specific to Groq's model naming conventions
- Error should suggest valid Groq models, including llama-3.3-70b-versatile and llama3-8b-8192
- The error should indicate this is a Groq-specific model issue

**Success Criteria:**
- Command fails with ModelNotFoundError
- Error message includes the invalid model name "invalid-model-xyz"
- Error suggests valid Groq models including llama-3.3-70b-versatile and llama3-8b-8192
- Error message is specific to Groq provider
- No partial response is generated
