import type { Command, CommandGenerator, CommandOptions, CommandMap } from '../types';
import { loadEnv } from '../config';
import { execSync } from 'child_process';

// Load environment variables
loadEnv();

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export class OllamaCommand implements Command {
  private subcommands: CommandMap = {
    list: { execute: this.listModels.bind(this) },
    pull: { execute: this.pullModel.bind(this) },
    status: { execute: this.checkStatus.bind(this) },
    install: { execute: this.installOllama.bind(this) },
  };

  private getHost(options?: CommandOptions): string {
    // Cast to access host property that may be added via CLI parsing
    const extendedOptions = options as CommandOptions & { host?: string };
    return extendedOptions?.host || process.env.OLLAMA_HOST || 'http://localhost:11434';
  }

  private validateModelName(modelName: string): { isValid: boolean; suggestion?: string } {
    // Check if model name follows the correct format (model:tag)
    if (!modelName.includes(':')) {
      // Common mistakes and their corrections
      const commonFixes: Record<string, string> = {
        'gpt-oss-20b': 'gpt-oss:20b',
        'gpt-oss-8b': 'gpt-oss:8b',
        'llama3.3-8b': 'llama3.3:8b',
        'llama3-8b': 'llama3:8b',
        'mistral-7b': 'mistral:7b',
        'codellama-7b': 'codellama:7b',
      };

      return {
        isValid: false,
        suggestion: commonFixes[modelName] || modelName.replace('-', ':'),
      };
    }

    // Basic format validation: should have at least one character before and after colon
    const parts = modelName.split(':');
    if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
      return {
        isValid: false,
        suggestion: undefined,
      };
    }

    return { isValid: true };
  }

  async *execute(query: string, options: CommandOptions): CommandGenerator {
    const [subcommand = 'status', ...rest] = query.split(' ');
    const subQuery = rest.join(' ');

    const subCommandHandler = this.subcommands[subcommand];
    if (subCommandHandler) {
      yield* subCommandHandler.execute(subQuery, options);
    } else {
      yield `Unknown ollama subcommand: ${subcommand}. Available subcommands: list, pull, status, install`;
    }
  }

  private async *listModels(query: string, options: CommandOptions): CommandGenerator {
    const host = this.getHost(options);

    try {
      console.log(`Connecting to Ollama at ${host}...`);

      const response = await fetch(`${host}/api/tags`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            'Ollama API endpoint not found. Please check if Ollama is installed and running.'
          );
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.models as OllamaModel[];

      if (!models || models.length === 0) {
        yield 'No models are currently installed.\n\nTo install a model, run: vibe-tools ollama pull <model-name>\nPopular models: gpt-oss-20b, llama3.3, mistral\n';
        return;
      }

      yield `Found ${models.length} installed model(s):\n\n`;

      for (const model of models) {
        const sizeGB = (model.size / (1024 * 1024 * 1024)).toFixed(1);
        const modifiedDate = new Date(model.modified_at).toLocaleDateString();
        yield `• ${model.name}\n  Size: ${sizeGB}GB, Modified: ${modifiedDate}\n`;
      }

      yield '\nTo download a new model, run: vibe-tools ollama pull <model-name>\n';
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`Failed to connect to Ollama daemon at ${host}`);
        console.error(
          'Make sure Ollama is installed and running. Install from: https://ollama.com'
        );
        throw new Error(`Ollama daemon not reachable at ${host}`);
      }
      throw error;
    }
  }

  private async *pullModel(query: string, options: CommandOptions): CommandGenerator {
    const modelName = query.trim();
    if (!modelName) {
      yield 'Please specify a model to pull. Example: vibe-tools ollama pull gpt-oss:20b\n';
      return;
    }

    // Validate and suggest corrections for common model name mistakes
    const validation = this.validateModelName(modelName);
    if (!validation.isValid) {
      yield `Invalid model name: ${modelName}\n`;
      if (validation.suggestion) {
        yield `Did you mean: ${validation.suggestion}?\n`;
      }
      yield `Correct format: model:tag (e.g., gpt-oss:20b, llama3.3:8b)\n\n`;
      yield `Common models:\n`;
      yield `- gpt-oss:20b\n`;
      yield `- llama3.3:8b\n`;
      yield `- mistral:7b\n`;
      return;
    }

    const host = this.getHost(options);

    try {
      console.log(`Connecting to Ollama at ${host}...`);
      console.log(`Starting download of model: ${modelName}`);

      const response = await fetch(`${host}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName,
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            'Ollama API endpoint not found. Please check if Ollama is installed and running.'
          );
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received from Ollama');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let lastStatus = '';
      let downloadSuccessful = false;
      let hasError = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            try {
              const progress = JSON.parse(line) as OllamaPullProgress;

              // Check for error conditions first
              if (
                progress.status.includes('error') ||
                progress.status.includes('not found') ||
                progress.status.includes('failed')
              ) {
                hasError = true;
                throw new Error(`Download failed: ${progress.status}`);
              }

              if (progress.status !== lastStatus) {
                if (progress.status === 'pulling manifest') {
                  yield `Downloading manifest for ${modelName}...\n`;
                } else if (progress.status === 'downloading') {
                  if (progress.total && progress.completed) {
                    const percent = Math.round((progress.completed / progress.total) * 100);
                    const completedMB = Math.round(progress.completed / (1024 * 1024));
                    const totalMB = Math.round(progress.total / (1024 * 1024));
                    yield `Downloading ${modelName}... ${percent}% (${completedMB}MB/${totalMB}MB)\n`;
                  } else {
                    yield `Downloading ${modelName}...\n`;
                  }
                } else if (progress.status === 'verifying sha256 digest') {
                  yield `Verifying download...\n`;
                } else if (progress.status === 'writing manifest') {
                  yield `Installing model...\n`;
                } else if (progress.status === 'removing any unused layers') {
                  yield `Cleaning up...\n`;
                } else if (progress.status === 'success') {
                  downloadSuccessful = true;
                  yield `Successfully downloaded ${modelName}!\n`;
                } else {
                  yield `${progress.status}\n`;
                }
                lastStatus = progress.status;
              }
            } catch (parseError) {
              // Skip malformed JSON lines, but re-throw download errors
              if (hasError) {
                throw parseError;
              }
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Check if download completed successfully
      if (!downloadSuccessful && !hasError) {
        throw new Error(
          `Download may have failed - no success confirmation received for ${modelName}`
        );
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`Failed to connect to Ollama daemon at ${host}`);
        console.error(
          'Make sure Ollama is installed and running. Install from: https://ollama.com'
        );
        throw new Error(`Ollama daemon not reachable at ${host}`);
      }
      throw error;
    }
  }

  private async *checkStatus(query: string, options: CommandOptions): CommandGenerator {
    const host = this.getHost(options);

    try {
      console.log(`Checking Ollama status at ${host}...`);

      // Check if daemon is running by hitting the tags endpoint
      const response = await fetch(`${host}/api/tags`);
      if (!response.ok) {
        if (response.status === 404) {
          yield `Ollama daemon is running at ${host} but API not found.\nPlease check your Ollama installation.\n`;
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models = (data.models as OllamaModel[]) || [];

      yield `✓ Ollama daemon is running at ${host}\n`;
      yield `✓ ${models.length} model(s) installed\n`;

      if (models.length > 0) {
        yield `✓ Available models: ${models.map((m) => m.name).join(', ')}\n`;
      } else {
        yield `⚠ No models installed. Run 'vibe-tools ollama pull <model>' to download a model.\n`;
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        yield `✗ Ollama daemon not reachable at ${host}\n`;

        // Check if ollama binary is installed
        let isOllamaInstalled = false;
        try {
          execSync('which ollama', { stdio: 'ignore' });
          isOllamaInstalled = true;
        } catch {
          // Ollama not installed
        }

        if (!isOllamaInstalled) {
          yield `✗ Ollama not found on system\n\n`;
          yield `Quick install (macOS only):\n`;
          yield `  vibe-tools ollama install\n\n`;
          yield `Manual installation:\n`;
          yield `1. Visit https://ollama.com\n`;
          yield `2. Download and install for your platform\n`;
          yield `3. Run: vibe-tools ollama status\n`;
        } else {
          yield `✗ Ollama installed but daemon not running\n\n`;
          yield `To start the daemon:\n`;
          yield `  ollama serve\n\n`;
          yield `Or check if it's running in the background:\n`;
          yield `  ps aux | grep ollama\n\n`;
          yield `Next steps after daemon is running:\n`;
          yield `1. Pull a model: vibe-tools ollama pull gpt-oss:20b\n`;
          yield `2. Test: vibe-tools ask "Hello" --provider=ollama\n`;
        }

        if (host !== 'http://localhost:11434') {
          yield `\nNote: Using custom host ${host} (set via --host or OLLAMA_HOST)\n`;
        }
        return;
      }
      throw error;
    }
  }

  private async ensureOllamaInstalled(): Promise<{ success: boolean; message: string }> {
    try {
      // Check if ollama binary exists
      try {
        execSync('which ollama', { stdio: 'ignore' });
        return { success: true, message: 'Ollama is already installed' };
      } catch {
        // Ollama not in PATH, proceed with installation
      }

      // Check if we're on macOS
      try {
        const platform = execSync('uname -s', { encoding: 'utf8' }).trim();
        if (platform !== 'Darwin') {
          return {
            success: false,
            message:
              'Automatic installation is only supported on macOS. Please visit https://ollama.com for installation instructions.',
          };
        }
      } catch {
        return {
          success: false,
          message:
            'Could not detect platform. Please visit https://ollama.com for installation instructions.',
        };
      }

      // Check if Homebrew is available
      try {
        execSync('which brew', { stdio: 'ignore' });
      } catch {
        return {
          success: false,
          message:
            'Homebrew is required for automatic installation. Please install Homebrew first or visit https://ollama.com for manual installation.',
        };
      }

      // Install via Homebrew
      execSync('brew install ollama', { stdio: 'inherit' });

      // Verify installation
      try {
        execSync('which ollama', { stdio: 'ignore' });
        return { success: true, message: 'Ollama installed successfully via Homebrew' };
      } catch {
        return {
          success: false,
          message:
            'Installation completed but ollama binary not found in PATH. Try restarting your terminal.',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Installation failed: ${errorMessage}`,
      };
    }
  }

  private async *installOllama(query: string, options: CommandOptions): CommandGenerator {
    yield 'Installing Ollama...\n\n';

    try {
      yield 'Checking system requirements...\n';

      const result = await this.ensureOllamaInstalled();

      if (result.success) {
        yield `✓ ${result.message}\n\n`;

        yield 'Next steps:\n';
        yield '1. Start Ollama daemon (should start automatically)\n';
        yield '2. Pull a model: vibe-tools ollama pull gpt-oss:20b\n';
        yield '3. Test: vibe-tools ask "Hello" --provider=ollama\n\n';

        yield 'Checking if daemon is running...\n';

        // Try to check status after installation
        const host = this.getHost(options);
        try {
          const response = await fetch(`${host}/api/tags`, {
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            yield '✓ Ollama daemon is running and ready!\n';
            yield 'You can now use: vibe-tools ollama list\n';
          } else {
            yield '⚠ Ollama installed but daemon may need to be started manually.\n';
            yield 'Try: ollama serve\n';
          }
        } catch {
          yield '⚠ Ollama installed but daemon not responding yet.\n';
          yield 'The daemon should start automatically, or try: ollama serve\n';
        }
      } else {
        yield `✗ ${result.message}\n\n`;
        yield 'Manual installation:\n';
        yield '1. Visit https://ollama.com\n';
        yield '2. Download and install for your platform\n';
        yield '3. Run: vibe-tools ollama status\n';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield `Installation failed: ${errorMessage}\n\n`;
      yield 'Please try manual installation:\n';
      yield '1. Visit https://ollama.com\n';
      yield '2. Download and install for your platform\n';
      yield '3. Run: vibe-tools ollama status\n';
    }
  }
}
