import type { ExecutionContext } from '@cloudflare/workers-types';

import type { WorkerEnv } from '../env.ts';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Suppress type errors if the module isn't found during editing/linting
import nitroApp from '../.output/server/index.mjs';

export default {
  async fetch(request: Request, environment: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return nitroApp.fetch(request, environment, ctx);
    }

    return environment.ASSETS.fetch(request);
  },
};
