import { spawn, spawnSync, ChildProcess } from 'node:child_process';

let ollamaProc: ChildProcess | undefined;
let cleanupRegistered = false;

function isMacOS(): boolean {
  return process.platform === 'darwin';
}

function isBinaryAvailable(): boolean {
  try {
    const result = spawnSync('sh', ['-lc', 'command -v ollama'], { stdio: 'pipe' });
    return (
      result.status === 0 &&
      String(result.stdout || '')
        .toString()
        .trim().length > 0
    );
  } catch {
    return false;
  }
}

export function ensureOllamaInstalled(): boolean {
  // Only support macOS for lazy installation
  if (!isMacOS()) {
    console.log('Ollama lazy installation only supported on macOS');
    return false;
  }

  // Check if ollama is already available
  if (isBinaryAvailable()) {
    console.log('Ollama is already installed');
    return true;
  }

  console.log('Ollama not found, attempting to install via Homebrew...');

  // Check if brew is available
  try {
    const brewCheck = spawnSync('command', ['-v', 'brew'], { stdio: 'pipe' });
    if (brewCheck.status !== 0) {
      console.error('Homebrew not found. Please install Ollama manually from https://ollama.com');
      return false;
    }
  } catch {
    console.error(
      'Failed to check for Homebrew. Please install Ollama manually from https://ollama.com'
    );
    return false;
  }

  // Try to install ollama via homebrew
  try {
    console.log('Installing Ollama via Homebrew...');
    const installResult = spawnSync('brew', ['install', '--cask', 'ollama'], {
      stdio: 'pipe',
      timeout: 120000, // 2 minute timeout
    });

    if (installResult.status === 0) {
      // Verify installation was successful
      if (isBinaryAvailable()) {
        console.log('Ollama successfully installed via Homebrew');
        return true;
      } else {
        console.error('Ollama installation completed but binary not found in PATH');
        return false;
      }
    } else {
      const stderr = installResult.stderr?.toString() || '';
      console.error(`Failed to install Ollama via Homebrew: ${stderr}`);
      return false;
    }
  } catch (error) {
    console.error(`Failed to install Ollama via Homebrew: ${(error as Error).message}`);
    return false;
  }
}

async function isServerRunning(host: string): Promise<boolean> {
  try {
    const res = await fetch(`http://${host.replace(/^https?:\/\//, '')}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

function registerCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  const cleanup = () => {
    try {
      if (ollamaProc && !ollamaProc.killed) {
        ollamaProc.kill('SIGTERM');
      }
    } catch {
      if (process.env.DEBUG) {
        console.log('[OllamaSetup] Failed to kill Ollama process during cleanup');
      }
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
}

export async function ensureOllamaServer(host: string): Promise<boolean> {
  // Return true if we started it ephemerally during this run
  const normalized = host.replace(/^https?:\/\//, '');

  // If it's already running, nothing to do
  if (await isServerRunning(normalized)) return false;

  // Only try to auto-start on macOS
  if (!isMacOS()) return false;

  // Check if binary is available, try to install if missing
  if (!isBinaryAvailable()) {
    if (!ensureOllamaInstalled()) {
      return false;
    }
  }

  // Start ollama serve in background
  const env = {
    ...process.env,
    OLLAMA_HOST: normalized,
    OLLAMA_KEEP_ALIVE: process.env.OLLAMA_KEEP_ALIVE || '180',
  };

  try {
    ollamaProc = spawn('ollama', ['serve'], {
      env,
      stdio: 'ignore',
      detached: true,
    });
    // Let the child continue if parent exits
    if (ollamaProc?.pid) ollamaProc.unref();
  } catch (error) {
    console.error(`Failed to start ephemeral Ollama: ${(error as Error).message}`);
    return false;
  }

  registerCleanup();

  // Poll for readiness (up to ~10s)
  const start = Date.now();
  while (Date.now() - start < 10000) {
    if (await isServerRunning(normalized)) {
      console.log(`Started ephemeral Ollama at http://${normalized}`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.error('Timed out waiting for ephemeral Ollama to become ready');
  return false;
}

export function wasEphemeralStarted(): boolean {
  return cleanupRegistered;
}
