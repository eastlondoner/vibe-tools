import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CommandOptions } from '../types';
import { getCurrentVersion } from './versionUtils';

const ENDPOINT = 'https://search.parallel.ai/mcp';
const USER_AGENT = 'vibe-tools (https://github.com/eastlondoner/vibe-tools)';

/** One invocation is one standalone research run, with no shared conversation state. */
export async function parallelWebSearch(
  query: string,
  options: Omit<CommandOptions, 'provider'>
): Promise<string> {
  if (options.model || options.maxTokens) {
    throw new Error(
      'Parallel returns source excerpts without a model. Omit --model/--max-tokens and web.model/web.maxTokens settings, or select an AI provider.'
    );
  }
  const timeout = options.timeout ?? 60000;
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('Timeout must be positive');
  const url = options.url ? new URL(options.url) : undefined;
  if (url && !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Page URL must use HTTP or HTTPS');
  }
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  options.signal?.throwIfAborted();
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error('Parallel request timed out')),
    timeout
  );
  const client = new Client({ name: 'vibe-tools', version: getCurrentVersion() });
  const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
    requestInit: { headers: { 'User-Agent': USER_AGENT } },
    // Apply the command deadline to discovery as well as execution and stream reads.
    fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }),
  });
  // The command owns this ID; clients/transports never own a global conversation ID.
  const sessionId = randomUUID();
  try {
    await client.connect(transport, { timeout, signal: controller.signal });
    const { tools } = await client.listTools({}, { timeout, signal: controller.signal });
    const name = url ? 'web_fetch' : 'web_search';
    if (!tools.some((tool) => tool.name === name)) {
      throw new Error(`Parallel does not advertise ${name}`);
    }
    const result = CallToolResultSchema.parse(
      await client.callTool(
        {
          name,
          arguments: url
            ? { urls: [url.href], objective: query.slice(0, 200), session_id: sessionId }
            : { objective: query, search_queries: [query], session_id: sessionId },
        },
        undefined,
        { timeout, signal: controller.signal }
      )
    );
    const text = result.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n');
    if (result.isError) throw new Error(text || 'Parallel tool failed');
    if (!text.trim()) throw new Error('Parallel returned no text content');
    return text + '\n';
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
    try {
      await client.close();
    } finally {
      controller.abort();
    }
  }
}
