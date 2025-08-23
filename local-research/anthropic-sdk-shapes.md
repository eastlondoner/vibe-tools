Querying perplexity using sonar-pro for: What are the exact Anthropic SDK request/response shapes for web search with citations and streaming in the beta messages API? with maxTokens: 8000
The exact **Anthropic SDK request/response shapes for web search with citations and streaming in the beta messages API** are as follows:

---

**Request Shape (messages API with web search & citations):**

```json
{
  "model": "claude-opus-4-1-20250805",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "How do I update a web app to TypeScript 5.5?"
    }
  ],
  "tools": [
    {
      "type": "web_search_20250305",
      "name": "web_search",
      "max_uses": 5,
      // Optional:
      // "allowed_domains": ["techcrunch.com", "wired.com"],
      // "blocked_domains": ["example-spam-site.com"],
      // "user_location": {
      //   "type": "approximate",
      //   "country": "US",
      //   "region": "California",
      //   "city": "San Francisco",
      //   "timezone": "America/Los_Angeles"
      // }
    }
  ],
  // To enable citations (beta, may depend on SDK or endpoint):
  "citations": {
    "enabled": true
  }
}
```
- The `tools` list includes the web search tool; its config can specify search usage limits, domain restrictions, and localization[3][5].
- The `citations` key (beta) triggers citation mode if supported[4].

**Streaming Requests:**
- To stream responses, invoke the API with the relevant SDK method or set a request header/parameter; the SDK typically surfaces this as an option (see `.asResponse()` for raw streaming[2]).

---

**Response Shape (web search, citations, streaming):**

A typical response will look like:

```json
{
  "id": "msg_01XYZ",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "TypeScript 5.5 brings several improvements..."
    },
    {
      "type": "citations",
      "citations": [
        {
          "start": 32,
          "end": 64,
          "source": {
            "url": "https://example.com/article",
            "title": "What's new in TypeScript 5.5",
            "published_at": "2025-08-01"
          }
        }
      ]
    }
  ],
  "model": "claude-opus-4-1-20250805",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 22,
    "output_tokens": 311
  }
}
```
- The `content` array can mix blocks of type `text` and `citations`. Citations specify which part of the text corresponds to a particular source, with offset mapping for precise attribution[4].
- If streaming, SDK methods like `.asResponse()` or event/callback-based streaming will yield chunks containing similar objects, typically one content block at a time[2].

---

**SDK Example (TypeScript/JavaScript):**

```typescript
const response = await client.messages.create({
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude' }],
  model: 'claude-sonnet-4-20250514',
  tools: [{
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 5,
  }],
  citations: { enabled: true }
}).withResponse(); // or .asResponse() for streaming
```
- `.withResponse()` yields the parsed message and raw response; use `.asResponse()` for streaming control[2].
- Returned message example:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Today's weather is sunny according to..."
    },
    {
      "type": "citations",
      "citations": [
        {
          "start": 30,
          "end": 68,
          "source": {
            "url": "https://weather-site.com/today",
            "title": "Weather Report"
          }
        }
      ]
    }
  ]
}
```

---

**Key Points**
- **Request**: Requires `model`, `max_tokens`, `messages`, and a `tools` array with a `web_search_20250305` tool. Optional beta `citations` is enabled with `{ "enabled": true }`[3][4][5].
- **Response**: Returns structured blocks in `content`, with `text` and (if citations enabled) additional `citations` blocks indicating which portions of the text cite particular sources[4].
- **Streaming**: Use SDK methods (`.asResponse()`) to stream raw response headers/body or handle events/chunks as they arrive[2].
- **Customization**: Tool options allow specifying domains, user location, and search usage, which impact results[5].

If you require further granularity (like exact streaming chunk formats or error shapes), Anthropic's SDK documentation and OpenAPI specs provide exhaustive schemas. These shapes are based on the latest (2025) public and SDK documentation.