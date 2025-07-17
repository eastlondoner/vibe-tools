import type { Config } from './types';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import dotenv from 'dotenv';
import { once } from './utils/once';
import { execSync } from 'child_process';

export const defaultMaxTokens = 21000;
export const defaultConfig: Config = {
  ide: 'cursor', // Default IDE
  web: {
    provider: 'perplexity',
  },
  plan: {
    fileProvider: 'gemini',
    thinkingProvider: 'openai',
    fileMaxTokens: defaultMaxTokens,
    thinkingMaxTokens: defaultMaxTokens,
  },
  repo: {
    provider: 'gemini',
    maxTokens: defaultMaxTokens,
  },
  doc: {
    maxRepoSizeMB: 100,
    provider: 'perplexity',
    maxTokens: defaultMaxTokens,
  },
  browser: {
    headless: true,
    defaultViewport: '1280x720',
    timeout: 120000,
  },
  stagehand: {
    provider: 'anthropic',
    verbose: false,
    debugDom: false,
    enableCaching: true,
  },
  tokenCount: {
    encoding: 'o200k_base',
  },
  perplexity: {
    model: 'sonar-pro',
    maxTokens: defaultMaxTokens,
  },
  groq: {
    model: 'moonshotai/kimi-k2-instruct',
    maxTokens: 8192,
  },
  reasoningEffort: 'medium', // Default reasoning effort for all commands
  disableDoppler: false,

  // Note that it is also permitted to add provider-specific config options
  // in the config file, even though they are not shown in this interface.
  // command specific configuration always overrides the provider specific
  // configuration
  //   modelbox: {
  //     model: 'google/gemini-2.5-flash', // Default model, can be overridden per command
  //     maxTokens: 8192,
  //  },
  //  openrouter: {
  //   model: 'google/gemini-2.5-pro'
  //   }
  //
  //  or
  //
  //   "gemini": {
  //     "model": "gemini-2.5-pro",
  //     "maxTokens": 10000
  //   }
  //
  //  or
  //
  //   "openai": {
  //     "model": "gpt-4o",
  //     "maxTokens": 10000
  //   }
  //
  // these would apply if the command was run with the --provider flag
  // or if provider is configured for a command without additional fields
  // e.g.
  //
  //   "repo": {
  //     "provider": "openai",
  //   }
  //
  //   "docs": {
  //     "provider": "gemini",
  //   }
  //
  // You can also configure MCP server overrides:
  //
  //   "mcp": {
  //     "overrides": {
  //       "my-server": {
  //         "githubUrl": "https://github.com/myuser/my-server",
  //         "command": "npx",
  //         "args": ["-y", "github:myuser/my-server@main"]
  //       }
  //     }
  //   }
};

function findConfigUpwards(
  filename = 'vibe-tools.config.json',
  maxDepth = 3,
  startDir: string = process.cwd()
): { path: string; data: unknown } | null {
  let currentDir = resolve(startDir);
  for (let depth = 0; depth <= maxDepth; depth++) {
    const candidate = join(currentDir, filename);
    try {
      if (existsSync(candidate)) {
        const raw = readFileSync(candidate, 'utf-8');
        return { path: candidate, data: JSON.parse(raw) };
      }
    } catch (error: any) {
      if (error?.code === 'EACCES' || error?.code === 'EPERM') {
        break;
      }
      // Other errors: ignore and continue
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) break; // reached filesystem root
    currentDir = parent;
  }
  return null;
}

export const loadConfig = once((): Config => {
  // Search upwards from cwd up to 3 levels
  const found = findConfigUpwards();
  if (found) {
    console.log('Loaded vibe-tools config from', found.path);
    return { ...defaultConfig, ...(found.data as Partial<Config>) };
  }

  // If not found, try home directory
  try {
    const homeConfigPath = join(homedir(), '.vibe-tools', 'config.json');
    const homeConfig = JSON.parse(readFileSync(homeConfigPath, 'utf-8'));
    return { ...defaultConfig, ...homeConfig };
  } catch {
    // If neither config exists, return default config
    return defaultConfig;
  }
});

export function applyEnvUnset(): void {
  // Check for CURSOR_TOOLS_ENV_UNSET environment variable
  const envUnset = process.env.CURSOR_TOOLS_ENV_UNSET;
  if (envUnset) {
    // Parse comma-separated list of keys to unset
    const keysToUnset = envUnset.split(',').map((key) => key.trim());
    if (keysToUnset.length > 0) {
      console.log(`Unsetting environment variables: ${keysToUnset.join(', ')}`);
      // Unset each key
      for (const key of keysToUnset) {
        delete process.env[key];
      }
    }
  }
}

function _loadEnv(): void {
  // Try loading from current directory first
  const localEnvPath = join(process.cwd(), '.vibe-tools.env');
  if (existsSync(localEnvPath)) {
    console.log('Local .env file found, loading env from', localEnvPath);
    dotenv.config({ path: localEnvPath });
  } else {
    // If local env doesn't exist, try home directory
    const homeEnvPath = join(homedir(), '.vibe-tools', '.env');
    if (existsSync(homeEnvPath)) {
      console.log('Home .env file found, loading env from', homeEnvPath);
      dotenv.config({ path: homeEnvPath });
    } else {
      // If neither env file exists, continue without loading
      console.log('No .env file found in local or home directories.', localEnvPath, homeEnvPath);
    }
  }

  // Doppler integration - runs regardless of .env file presence
  console.log('[Doppler] Starting integration check');
  const config = loadConfig();
  if (config.disableDoppler) {
    console.log('[Doppler] Skipped: disabled in config');
    return;
  }

  // Check if Doppler CLI is available
  let hasDoppler = true;
  try {
    execSync('command -v doppler', { stdio: 'ignore', env: process.env });
  } catch {
    hasDoppler = false;
  }
  if (!hasDoppler) {
    console.log('[Doppler] Skipped: CLI not found on PATH');
    return;
  }

  try {
    console.log('[Doppler] Attempting detection');
    let workingDir = process.cwd();
    let output = execSync('doppler configure --json', { env: process.env }).toString().trim();
    console.log(
      '[Doppler] Configure output (redacted):',
      output.replace(/"token":"[^"]+"/g, '"token":"[REDACTED]"')
    );
    let configJson = JSON.parse(output);
    let dirConfig = configJson[workingDir];

    // If current directory isn't configured, search up to 4 parent levels that
    // contain a .git folder and retry detection from that directory.
    if (!dirConfig || !dirConfig['enclave.project'] || !dirConfig['enclave.config']) {
      console.log('[Doppler] Directory not configured, searching parent directories for .git');
      let searchDir = workingDir;
      for (let depth = 1; depth <= 4; depth++) {
        const parentDir = dirname(searchDir);
        if (parentDir === searchDir) break; // reached filesystem root
        searchDir = parentDir;

        // Skip if no .git folder in this parent directory
        if (!existsSync(join(searchDir, '.git'))) continue;

        try {
          output = execSync('doppler configure --json', { env: process.env, cwd: searchDir })
            .toString()
            .trim();
          console.log(
            '[Doppler] Parent configure output (redacted):',
            output.replace(/"token":"[^"]+"/g, '"token":"[REDACTED]"')
          );
          configJson = JSON.parse(output);
          dirConfig = configJson[searchDir];
          if (dirConfig && dirConfig['enclave.project'] && dirConfig['enclave.config']) {
            workingDir = searchDir;
            console.log('[Doppler] Found configured directory:', workingDir);
            break;
          }
        } catch (err) {
          console.warn(`[Doppler] Configure failed in ${searchDir}: ${(err as Error).message}`);
        }
      }
    }

    if (!dirConfig || !dirConfig['enclave.project'] || !dirConfig['enclave.config']) {
      console.log('[Doppler] Skipped: directory not configured');
      return;
    }

    console.log('[Doppler] Directory configured for project:', dirConfig['enclave.project']);

    console.log('[Doppler] Fetching secrets');
    const secretsOutput = execSync('doppler secrets --json', { env: process.env, cwd: workingDir })
      .toString()
      .trim();
    const secrets = JSON.parse(secretsOutput);
    console.log('[Doppler] Fetched', Object.keys(secrets).length, 'secrets');

    // Set environment variables if not already set
    let loadedCount = 0;
    for (const key of Object.keys(secrets)) {
      if (key.endsWith('_API_KEY') && !process.env[key]) {
        // Extract the computed value from the nested structure
        const secretValue = secrets[key]?.computed;
        if (secretValue) {
          process.env[key] = secretValue;
          loadedCount++;
        }
      }
    }

    console.log(
      `Loaded ${loadedCount} secrets from Doppler for project ${dirConfig['enclave.project']}.`
    );
    console.log('[Doppler] Loaded', loadedCount, 'new environment variables');
  } catch (error) {
    console.warn(`[Doppler] Fetch failed: ${(error as Error).message}. Skipping.`);
    console.log('[Doppler] Error details:', error);
  }
}

export const loadEnv = once(() => {
  _loadEnv();
  applyEnvUnset();
});
