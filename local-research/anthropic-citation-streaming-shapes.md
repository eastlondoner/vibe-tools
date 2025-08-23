Querying perplexity using sonar-pro for: What are the exact Anthropic streaming event shapes for citations? Show me the TypeScript interface definitions and streaming event examples with citation_delta events. with maxTokens: 8000
Anthropic streaming events for citations use a dedicated event type: **citations_delta**. This is streamed as part of the content block events, allowing you to incrementally build up the list of citations attached to each generated content block[5][1].

Below are the **TypeScript interface definitions** and a **streaming event example** for **citations_delta** events:

---

### TypeScript Interface Definitions

These are inferred directly from Anthropic's documentation and consistent with SDK types[5][2]:

```typescript
// Top-level event discriminator
type ContentBlockDeltaEvent =
  | ThinkingDeltaEvent
  | SignatureDeltaEvent
  | TextDeltaEvent
  | CitationsDeltaEvent;

interface TextDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: 'text_delta';
    text: string; // incrementally streamed text
  };
}

interface CitationsDeltaEvent {
  type: 'content_block_delta';
  index: number; // Index of this content block in the response
  delta: {
    type: 'citations_delta';
    citation: Citation; // Citation object as described below
  };
}

// Citation shape (based on Anthropic docs)
interface Citation {
  /** Unique identifier for the citation */
  id: string;
  /** The cited text (quote) */
  cited_text: string;
  /** The document title */
  title?: string;
  /** Pointer or offset to the position in source document */
  location?: object;
  /** Source document metadata */
  source: {
    type: 'text';
    media_type: string;
    data?: string;
    // ...additional Anthropic source fields
  };
  // ...potentially more fields (author, url, etc.)
}
```
Other streaming event types can be found in the [official SDK][2] and [docs][3][5].

---

### Streaming Event Example with citations_delta

A typical event streamed from Anthropic that delivers an incremental citation looks like this[5]:

```json
{
  "event": "content_block_delta",
  "data": {
    "type": "content_block_delta",
    "index": 0,
    "delta": {
      "type": "citations_delta",
      "citation": {
        "id": "e3ac80a9",
        "cited_text": "The grass is green.",
        "title": "My Document",
        "location": { "start": 0, "end": 17 },
        "source": {
          "type": "text",
          "media_type": "text/plain",
          "data": "The grass is green. The sky is blue."
        }
      }
    }
  }
}
```

- The **index** identifies the content block this event refers to.
- Type **citations_delta** denotes that this event delivers a single citation.
- Multiple **citations_delta** events may arrive for the same block as citations accumulate.
- These are interleaved with **text_delta** events as text and citations stream.

---

**Key Points on Streaming Citation Events:**

- **citations_delta** events are streamed as "deltas," one per citation as the block is generated[5][1].
- Each event adds a citation to the current block's citation list.
- Citation shape is explicit, with fields like cited_text and source.

For further detail and real-world shapes, consult the [Anthropic documentation on citations][5].