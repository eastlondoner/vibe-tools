# Feature Behavior: Direct Model Query Capability

## Description

vibe-tools should enable users to directly query any AI model from any provider. The ask command should handle various provider and model combinations, providing appropriate error messages when necessary.

## Test Scenarios

### Scenario 1: Basic Direct Query (Happy Path)

**Task Description:**
Use vibe-tools to ask a simple factual question using a specific provider and model.

Use this query: [[asset:simple-query]]

**Expected Behavior:**

- The AI agent should determine the appropriate command to use with provider and model specified
- The response should include the correct answer to the factual question
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly uses ask command with appropriate provider and model parameters
- Response contains relevant information that answers the question
- No error messages are displayed
- Command completes within a reasonable time

### Scenario 2: Query with Alternative Provider and Model (Happy Path)

**Task Description:**
Use vibe-tools to ask the question "What is virtue ethics?" using each provider with the default model (do not specify a model parameter):

- Gemini
- Anthropic
- OpenRouter
- ModelBox
- OpenAI
- Groq
- XAI
- Perplexity

Keep going until you have tested all providers.

**Expected Behavior:**

- The AI agent should determine the appropriate command for each provider
- The response should include the answer to the question
- The command output should indicate the specified provider and model are being used

**Success Criteria:**

- AI agent correctly specifies the provider and figures out a valid model to use
- Every provider should be tested
- Response contains relevant information answering the question
- No error messages are displayed
- Command completes within a reasonable time

### Scenario 3: Query without Provider Parameter

**Task Description:**
Attempt to use vibe-tools to ask a question without specifying a provider.

Ask the question: "Who is the current president of the United States?"

**Expected Behavior:**

- The command should succeed using a default provider
- The output should indicate which provider and model was used
- The response should be relevant to the question, the model may explain that it does not have access to up to date information, that is OK

**Success Criteria:**

- Command succeeds using a default provider
- Output indicates which provider and model were used
- Response is relevant to the question. DO NOT concern yourself with the factual accuracy of the response
- No partial or corrupted output is generated

### Scenario 4: Query with Invalid Model (Error Handling)

**Task Description:**
Attempt to use vibe-tools to ask a question with a valid provider but an invalid model name. To create an invalid model name append `-huge` to the model name.
When the command fails follow up by asking the question again with one of the provided model names from the error message.

**Expected Behavior:**

- The first command should fail with a clear error message
- The error message should mention that the specified model is invalid or not found
- The error message should provide suggested valid models for the provider
- The second command should succeed using the provided model name from the error message
- The response should be relevant to the question
- The output should indicate which provider and model were used

**Success Criteria:**

- AI agent recognizes the invalid model error
- Command fails gracefully with informative error message
- Error message includes suggestions for valid models
- No partial or corrupted output is generated

### Scenario 5: Query with Missing API Key (Error Handling)

**Task Description:**
Attempt to use vibe-tools to ask a question using a provider for which no API key is configured. To do this set the API key env var to an empty string like this: `<PROVIDER>_API_KEY="" vibe-tools ask <params and query>`. Repeat this for 3 providers.

**Expected Behavior:**

- When the API key is not available, the command should fail with a clear error message
- Error message should mention the missing API key
- Error message should provide guidance on how to configure the API key

**Success Criteria:**

- AI agent recognizes the missing API key issue
- Command fails gracefully with informative error message
- Error message provides guidance on fixing the issue
- No partial or corrupted output is generated

### Scenario 6: Query with Maximum Tokens Parameter (Happy Path)

**Tags:** tokens, parameters
**Task Description:**
Use vibe-tools to ask a question that requires a longer response, specifying a maximum token limit.

**Expected Behavior:**

- The AI agent should determine the appropriate command with provider, model, and max-tokens parameter
- The response should adhere to the specified token limit
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly includes the max-tokens parameter in the command
- Response respects the token limit specified
- No error messages are displayed
- Command completes within a reasonable time

### Scenario 7: Query with Debug Option (Happy Path)

**Tags:** debug, parameters
**Task Description:**
Use vibe-tools to ask a simple question with the debug option enabled.

**Expected Behavior:**

- The AI agent should include the debug flag in the command
- The command should display additional debugging information
- The response should still include the answer to the question

**Success Criteria:**

- AI agent correctly includes the debug flag in the command
- Debug information is displayed in the output
- Response contains relevant information answering the question
- Command completes successfully

### Scenario 8: Query with Save-To Option (Happy Path)

**Tags:** file-io, parameters
**Task Description:**
Use vibe-tools to ask a question and save the output to a file.

**Expected Behavior:**

- The AI agent should include the save-to parameter in the command
- The response should be saved to the specified file
- The command should complete successfully without errors

**Success Criteria:**

- AI agent correctly includes the save-to parameter in the command
- Response is saved to the specified file
- File contains the same content as displayed in the console
- Command completes successfully

### Scenario 9: Extremely Long Query (Edge Case)

**Tags:** edge-case
**Task Description:**
Use vibe-tools to ask a very long question (over 500 characters).

Use the query from this file: {{path:scenario9-long-query.txt}}

**Expected Behavior:**

- The AI agent should construct a command with the long query
- The command should handle the long query without crashing
- The response should be relevant to the query

**Success Criteria:**

- AI agent successfully passes the long query to the ask command
- Command completes successfully
- Response is relevant to the query
- No error messages about query length

### Scenario 10: Model Not Found Error Reporting (Error Handling)

**Tags:** error-handling, model-errors
**Task Description:**
Attempt to use vibe-tools to ask a question with an OpenAI provider but 
use a non-existent model name "o3-HUGE". Do not pass the --debug flag.

Use this query: [[asset:simple-query]]

**Expected Behavior:**

- The command should fail with an error message indicating the model was not found
- The output should include the specific non-existent model name that was requested
- The output should provide details of one or more available models for the provider
- Debug mode should NOT be required to see detailed error information

**Success Criteria:**

- AI agent recognizes the model not found error
- Command fails gracefully with an informative error message
- Error message includes the specific model name that was not found
- Error details are visible in the standard output without using the --debug flag
- Error message provides guidance on available models or how to fix the issue
