# Feature Behavior: VIBE_TOOLS_ Prefixed Environment Variables

## Description

vibe-tools should support environment variables prefixed with `VIBE_TOOLS_` that take precedence over non-prefixed environment variables. This applies to both regular environment variables and those fetched from Doppler. When both `VIBE_TOOLS_<NAME>` and `<NAME>` exist, the prefixed version should always win.

## Test Scenarios

### Scenario 1: Basic Prefix Override (Happy Path)

**Tags:** env-vars, prefix-override, happy-path
**Task Description:**
Set both prefixed and non-prefixed API keys, then use vibe-tools ask to verify that the prefixed version takes precedence.

Set environment variables:
- `VIBE_TOOLS_OPENAI_API_KEY=prefixed_key_123`  
- `OPENAI_API_KEY=non_prefixed_key_456`

Then ask a simple question using OpenAI provider: "What is 2+2?"

**Expected Behavior:**
- The AI agent should use the ask command with OpenAI provider
- The command should use the prefixed API key (prefixed_key_123) internally
- If the prefixed key is valid and the non-prefixed key is invalid, the command should succeed
- If both keys are invalid, the command should fail but use the prefixed key in error messages

**Success Criteria:**
- AI agent correctly uses ask command with OpenAI provider
- Command attempts to use prefixed API key (evidenced by success if prefixed key is valid, or error mentioning the prefixed key)
- Response contains answer to the math question if API key is valid
- No error messages about missing API key configuration

### Scenario 2: Multiple Provider Prefix Override (Happy Path)

**Tags:** env-vars, prefix-override, multiple-providers
**Task Description:**
Test prefix override functionality across multiple providers by setting both prefixed and non-prefixed API keys for different providers.

Set environment variables:
- `VIBE_TOOLS_ANTHROPIC_API_KEY=prefixed_anthropic_123`
- `ANTHROPIC_API_KEY=non_prefixed_anthropic_456`
- `VIBE_TOOLS_GROQ_API_KEY=prefixed_groq_789`
- `GROQ_API_KEY=non_prefixed_groq_012`

Ask the same question "Explain photosynthesis briefly" using both Anthropic and Groq providers in separate commands.

**Expected Behavior:**
- Both commands should attempt to use the prefixed API keys
- If prefixed keys are valid, both commands should succeed
- Each command should use the correct prefixed key for its respective provider

**Success Criteria:**
- Both ask commands execute with their respective providers
- Commands use prefixed API keys (evidenced by success or specific error behavior)
- Responses contain relevant information about photosynthesis if keys are valid
- No cross-contamination between provider keys

### Scenario 3: Prefix Only (No Non-Prefixed Variable)

**Tags:** env-vars, prefix-only, happy-path  
**Task Description:**
Test that prefixed environment variables work correctly when no non-prefixed version exists.

Unset any existing `OPENAI_API_KEY` and set only:
- `VIBE_TOOLS_OPENAI_API_KEY=only_prefixed_key`

Ask a question using OpenAI provider: "What is the square root of 16?"

**Expected Behavior:**
- The AI agent should use the ask command with OpenAI provider
- The command should successfully find and use the prefixed API key
- If the key is valid, the command should complete successfully

**Success Criteria:**
- AI agent correctly uses ask command with OpenAI provider
- Command successfully uses prefixed-only API key
- Response contains answer to the math question if API key is valid
- No error messages about missing API key

### Scenario 4: No Prefix, Non-Prefixed Only (Backward Compatibility)

**Tags:** env-vars, backward-compatibility, happy-path
**Task Description:**
Verify that existing non-prefixed environment variables continue to work when no prefixed version exists.

Unset any existing `VIBE_TOOLS_OPENAI_API_KEY` and set only:
- `OPENAI_API_KEY=regular_key_789`

Ask a question using OpenAI provider: "Name three primary colors"

**Expected Behavior:**
- The AI agent should use the ask command with OpenAI provider  
- The command should use the regular non-prefixed API key
- Existing functionality should remain unchanged

**Success Criteria:**
- AI agent correctly uses ask command with OpenAI provider
- Command successfully uses non-prefixed API key
- Response contains list of primary colors if API key is valid
- Backward compatibility is maintained

### Scenario 5: Empty Prefixed Variable (Edge Case)

**Tags:** env-vars, edge-case, empty-values
**Task Description:**
Test behavior when prefixed environment variable is set but empty.

Set environment variables:
- `VIBE_TOOLS_OPENAI_API_KEY=""`  (empty string)
- `OPENAI_API_KEY=fallback_key_123`

Ask a question using OpenAI provider: "What is the capital of Japan?"

**Expected Behavior:**
- The system should handle empty prefixed variables appropriately
- Behavior should either use the fallback key or fail gracefully with clear error message
- No undefined behavior or crashes should occur

**Success Criteria:**
- Command handles empty prefixed variable without crashing
- Either uses fallback key successfully or provides clear error message  
- No undefined or erratic behavior
- Error messages (if any) are informative and actionable

### Scenario 6: Case Sensitivity Test (Edge Case)

**Tags:** env-vars, edge-case, case-sensitivity
**Task Description:**
Test that the prefix matching is case-sensitive as expected.

Set environment variables:
- `vibe_tools_OPENAI_API_KEY=lowercase_prefix_key` (lowercase prefix)
- `VIBE_TOOLS_OPENAI_API_KEY=correct_prefix_key` (uppercase prefix)
- `OPENAI_API_KEY=fallback_key`

Ask a question using OpenAI provider: "What is 10 divided by 2?"

**Expected Behavior:**
- Only the correctly cased `VIBE_TOOLS_` prefix should be recognized
- The lowercase `vibe_tools_` should be ignored
- The command should use `correct_prefix_key` value

**Success Criteria:**
- Command uses the correctly cased prefixed variable (VIBE_TOOLS_)
- Incorrectly cased prefix is ignored
- Response contains answer to the math question if API key is valid

### Scenario 7: Debug Output Verification (Debugging)

**Tags:** env-vars, debug, transparency
**Task Description:**
Use debug mode to verify that prefixed environment variables are being processed correctly.

Set environment variables:
- `VIBE_TOOLS_OPENAI_API_KEY=debug_test_key_123`
- `OPENAI_API_KEY=regular_debug_key_456`  

Ask a question using OpenAI provider with debug flag enabled: "Hello world"

**Expected Behavior:**
- Debug output should show evidence of environment variable processing
- Should indicate which API key is being used (without revealing the full key for security)
- Debug logs should help verify the prefix override functionality

**Success Criteria:**
- Command executes with debug flag enabled
- Debug output contains information about environment variable processing
- Evidence that prefixed variable takes precedence is visible in debug logs
- No sensitive API key information is fully exposed in logs

### Scenario 8: Configuration File Integration Test (Integration)

**Tags:** env-vars, integration, config-files
**Task Description:**
Test that VIBE_TOOLS_ prefixed variables work correctly when vibe-tools loads configuration from ~/.vibe-tools/.env files.

Create a temporary test configuration file with:
```
VIBE_TOOLS_OPENAI_API_KEY=config_file_prefixed_key  
OPENAI_API_KEY=config_file_regular_key
```

Ask a question using OpenAI provider: "What is the largest planet in our solar system?"

**Expected Behavior:**
- The configuration file should be loaded correctly
- The prefixed variable from the config file should take precedence
- The command should use the prefixed API key from the configuration

**Success Criteria:**
- Command successfully loads configuration from file
- Uses prefixed API key from configuration file
- Response contains answer about Jupiter if API key is valid
- Precedence rules apply correctly for file-based configuration 