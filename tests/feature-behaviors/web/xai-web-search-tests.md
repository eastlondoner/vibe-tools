# XAI Web Search Tests

## Test Scenarios

### Basic Web Search Test
```bash
vibe-tools web "latest developments in AI in 2024" --provider xai
```

**Expected Behavior:**
- Should use `grok-4-latest` model (default web model for XAI)
- Should include `search_parameters` in request with `mode: "auto"` and `return_citations: true`
- Should return current information about AI developments
- Should include citations in the response

### Custom Model Web Search Test
```bash
vibe-tools web "current weather in New York" --provider xai --model grok-3-mini-latest
```

**Expected Behavior:**
- Should use the specified `grok-3-mini-latest` model
- Should enable web search with search parameters
- Should return current weather information
- Should include citations from weather sources

### Citation Handling Test
```bash
vibe-tools web "who won the latest Nobel Prize in Physics" --provider xai --debug
```

**Expected Behavior:**
- Should show `search_parameters` in debug logs
- Should return current Nobel Prize winner information
- Should append citations section to response
- Citations should be formatted as a list with URLs

### Reasoning Effort + Web Search Test
```bash
vibe-tools web "analyze the latest trends in renewable energy technology" --provider xai --reasoning-effort high
```

**Expected Behavior:**
- Should combine both `reasoning_effort: "high"` and `search_parameters` in request
- Should provide detailed analysis with current data
- Should include citations for sources
- Should show both parameters in debug logs

### Current Events Test
```bash
vibe-tools web "latest news about space exploration" --provider xai
```

**Expected Behavior:**
- Should return up-to-date information about space missions
- Should include citations from news sources
- Should not return outdated information

### Technical Query Test
```bash
vibe-tools web "latest version of React and new features" --provider xai
```

**Expected Behavior:**
- Should return current React version and features
- Should include citations from official documentation
- Should provide accurate technical information

### Error Handling Tests

#### Invalid Model Test
```bash
vibe-tools web "test query" --provider xai --model invalid-model
```

**Expected Behavior:**
- Should throw `ModelNotFoundError`
- Should list available XAI models
- Should not crash the application

#### Missing API Key Test
```bash
# Remove XAI_API_KEY from environment
unset XAI_API_KEY
vibe-tools web "test query" --provider xai
```

**Expected Behavior:**
- Should throw `ApiKeyMissingError` with message about X.AI
- Should not crash the application

### Provider Auto-Selection Test
```bash
vibe-tools web "current stock market trends"
```

**Expected Behavior:**
- Should automatically select an available web-capable provider
- If XAI is available, it should be in the selection order
- Should work without explicitly specifying provider

## Test Setup

### Environment Variables Required
```bash
export XAI_API_KEY="your-xai-api-key"
```

### Provider Availability Test
```bash
vibe-tools web "test query" --provider xai 2>&1 | grep -i "provider.*available"
```

**Expected Behavior:**
- Should not show "provider not available" error when XAI_API_KEY is set
- Should work seamlessly with web search

## Expected Debug Output Format

When running with `--debug`, should see:
```
[XAIProvider] Request to https://api.x.ai/v1/chat/completions
[XAIProvider] Model: grok-4-latest
[XAIProvider] Max tokens: 4000
[XAIProvider] Web search enabled with search_parameters
[XAIProvider] Request messages: [{"role":"user","content":"..."}]
[XAIProvider] Full request parameters: {
  "model": "grok-4-latest",
  "messages": [...],
  "max_tokens": 4000,
  "search_parameters": {
    "mode": "auto",
    "return_citations": true
  }
}
[XAIProvider] API call completed in 2150ms
[XAIProvider] Response: {"choices":[{"message":{"content":"..."}}],"citations":["https://example.com/source1","https://example.com/source2"],"usage":{"prompt_tokens":25,"completion_tokens":180,"total_tokens":205}}
```

## Citation Format

The response should include citations in the format:
```
[Main response content]

Citations:
https://example.com/source1
https://example.com/source2  
https://example.com/source3
```

## Request Parameters

The web search request should include:
```json
{
  "model": "grok-4-latest",
  "messages": [...],
  "max_tokens": 4000,
  "search_parameters": {
    "mode": "auto",
    "return_citations": true
  }
}
```

## Provider Integration

### Web Command Integration
- XAI should be included in `DEFAULT_WEB_MODELS` with `grok-4-latest`
- XAI should be in the provider preference order for web searches
- `supportsWebSearch()` should return `{ supported: true }` for all Grok models

### Search Parameters
- `mode`: Should be set to "auto" for automatic search relevance
- `return_citations`: Should be set to true to get source URLs
- Should only be added when `webSearch` option is enabled

## Performance Expectations

- Web search queries should typically take 2-5 seconds
- Should handle concurrent requests appropriately
- Should not timeout on reasonable queries
- Should provide meaningful error messages for API failures

## Notes

- All XAI Grok models support web search capability
- Citations are appended to the response content
- Web search is enabled by default for the `web` command
- The provider should handle both real-time information and citations
- Error handling should be consistent with other web-capable providers 