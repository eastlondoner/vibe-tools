Querying perplexity using sonar-pro for: What is the exact tool type name for Anthropic web search in the latest 2025 beta API? Is it web_search_20250305 or something else? with maxTokens: 8000
The exact tool type name for **Anthropic web search in the latest 2025 beta API is**:  
**web_search_20250305**

In API requests, it should be defined as:
```json
{
  "type": "web_search_20250305",
  "name": "web_search"
}
```
This is confirmed across multiple recent and authoritative sources including AI SDK documentation and API usage guides from May–June 2025[1][2][4][5]. The same type string—**web_search_20250305**—is required for enabling and configuring the web search tool with supported models such as Claude Opus 4 and Claude Sonnet 4[1][3][5].

No newer tool type name is documented as of June 2025; **web_search_20250305** is the latest official for the web search feature in production and beta APIs[2][4][5].