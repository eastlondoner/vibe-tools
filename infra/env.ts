import type { worker } from './alchemy/alchemy.run.ts';

export type WorkerEnv = typeof worker.Env;

declare module 'cloudflare:workers' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export interface Env extends WorkerEnv {}
  }
}
