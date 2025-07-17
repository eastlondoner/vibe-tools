import type {
  ToolDefinition,
  ToolExecutionResult,
} from '../../utils/tool-enabled-llm/unified-client';

import * as child_process from 'child_process';
import * as path from 'path';

// Track active child processes for cleanup
const activeProcesses = new Set<child_process.ChildProcess>();

// Add cleanup function for active processes
export function cleanupAllProcesses() {
  for (const proc of activeProcesses) {
    try {
      if (proc.pid && !proc.killed) {
        proc.kill('SIGTERM');
        activeProcesses.delete(proc);
      }
    } catch (error) {
      console.error('Error killing process:', error);
    }
  }
  activeProcesses.clear();
}

// Execute command with subprocess tracking
async function execWithTracking(
  command: string,
  options: child_process.ExecOptions
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = child_process.exec(command, options, (error, stdout, stderr) => {
      // Remove from active processes when done
      activeProcesses.delete(child);

      if (error) {
        console.error('Error executing command:', error);
        resolve({ stdout, stderr, exitCode: error.code || 1 });
      } else {
        resolve({ stdout, stderr, exitCode: 0 });
      }
    });

    // Track the child process
    activeProcesses.add(child);

    // Handle child process exit
    child.on('exit', () => {
      activeProcesses.delete(child);
    });

    child.on('error', (error) => {
      activeProcesses.delete(child);
    });
  });
}

// Whitelist of permitted shell commands that can be executed directly
const WHITELISTED_COMMANDS = ['ls', 'cat', 'grep', 'find', 'pwd', 'sqlite3', 'test'];

/**
 * Creates a tool for executing vibe-tools commands in an isolated environment.
 */
export function createCommandExecutionTool(options: {
  debug: boolean;
  cwd?: string;
  scenarioId: string;
  env?: Record<string, string | undefined>;
  appendToBuffer: (text: string, shouldPrefix?: boolean) => void;
}): ToolDefinition {
  const { debug, cwd, appendToBuffer, env } = options;
  // Note: scenarioId is used in the type definition but not in the function body

  return {
    name: 'execute_command',
    description: 'Execute a vibe-tools command',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The vibe-tools command to execute',
        },
      },
      required: ['command'],
    },
    execute: async (arg: { command: string } | string): Promise<ToolExecutionResult> => {
      let command: string;
      if (typeof arg === 'string') {
        if (arg.startsWith('{')) {
          command = JSON.parse(arg).command;
        } else {
          command = arg;
        }
      } else {
        command = arg.command;
      }
      if (!command || typeof command !== 'string') {
        console.log('command', arg);
        return {
          success: false,
          output: 'Invalid command: Command must be a non-empty string',
          error: {
            message: 'Invalid command parameter',
          },
        };
      }
      // Extract environment variables and vibe-tools command
      const envVarRegex = /^(?:(?:[A-Z_][A-Z0-9_]*=[^\s]*\s+)*)?(?=vibe-tools|$)/i;
      const envMatch = command.match(envVarRegex);
      const envVars: Record<string, string> = {};

      if (envMatch && envMatch[0]) {
        const envString = envMatch[0].trim();
        const envPairs = envString.match(/[A-Z_][A-Z0-9_]*=[^\s]*/gi) || [];
        envPairs.forEach((pair) => {
          const [key, value] = pair.split('=');
          envVars[key] = value;
        });
      }

      // Extract the actual command and arguments
      const commandPart = command.slice(envMatch ? envMatch[0].length : 0);

      // Check if it's a vibe-tools command
      const cursorToolsMatch = commandPart.match(/^vibe-tools\s+([^\s]+)(.*)$/);

      // Check if it's a whitelisted shell command
      const shellCommandMatch = commandPart.match(/^([^\s]+)(.*)$/);

      // Set working directory
      const workingDir = cwd || process.cwd();

      if (cursorToolsMatch) {
        // Handle vibe-tools command
        const [, subCommand, args] = cursorToolsMatch;
        return await executeCursorToolsCommand(
          commandPart,
          subCommand,
          args,
          envVars,
          workingDir,
          appendToBuffer
        );
      } else if (shellCommandMatch) {
        // Check if the command is in the whitelist
        const [, shellCommand, shellArgs] = shellCommandMatch;

        if (WHITELISTED_COMMANDS.includes(shellCommand)) {
          // Handle whitelisted shell command
          return await executeShellCommand(shellCommand, shellArgs, envVars, workingDir);
        } else {
          // Not a whitelisted command
          const errorMessage = `Command '${shellCommand}' is not allowed. Permitted commands are: vibe-tools and [${WHITELISTED_COMMANDS.join(', ')}]`;
          console.error(errorMessage);
          return {
            success: false,
            output: errorMessage,
            error: {
              message: 'Command not allowed',
              details: {
                command: shellCommand,
                allowedCommands: ['vibe-tools', ...WHITELISTED_COMMANDS],
              },
            },
          };
        }
      } else {
        // No valid command found
        const errorMessage = `Invalid command format. Expected: [ENV_VARS] vibe-tools <command> [options] or one of the whitelisted commands: [${WHITELISTED_COMMANDS.join(', ')}]`;
        console.error(errorMessage, command);
        return {
          success: false,
          output: errorMessage,
          error: {
            message: 'Invalid command format',
          },
        };
      }

      // Helper function to execute vibe-tools commands
      async function executeCursorToolsCommand(
        commandPart: string,
        subCommand: string,
        args: string,
        envVars: Record<string, string>,
        workingDir: string,
        appendToBuffer: (text: string, shouldPrefix?: boolean) => void
      ): Promise<{
        success: boolean;
        output: string;
        error?: { message: string; stack?: string };
      }> {
        const projectRoot = process.cwd();
        const vibeToolsEntryPoint = path.resolve(projectRoot, 'src', 'index.ts');

        const envPrefix = envVars
          ? Object.entries(envVars)
              .map(([key, value]) => `${key}="${value}"`)
              .join(' ') + ' '
          : '';

        const fullCommand = `${envPrefix}node --import=tsx "${vibeToolsEntryPoint}" ${subCommand}${args}`;

        appendToBuffer(`Executing command: ${fullCommand} in cwd: ${workingDir}\n`);

        const execOptions = {
          cwd: workingDir,
          env: { ...process.env, ...envVars },
        };

        try {
          const { stdout, stderr, exitCode } = await execWithTracking(fullCommand, execOptions);

          const output = stdout.trim();
          const errorOutput = stderr.trim();

          appendToBuffer(`Command output: ${output}\n`);
          if (errorOutput) {
            appendToBuffer(`Stderr (warnings): ${errorOutput}\n`);
          }

          if (exitCode !== 0) {
            appendToBuffer(`Command failed with exit code ${exitCode}\n`);
            return {
              success: false,
              output: output + '\n' + errorOutput,
              error: { message: `Command failed with exit code ${exitCode}` },
            };
          }

          return { success: true, output: output };
        } catch (error: any) {
          appendToBuffer(`Error executing command: ${error.message}\n`);
          return {
            success: false,
            output: '',
            error: { message: error.message, stack: error.stack },
          };
        }
      }

      // Helper function to execute whitelisted shell commands
      async function executeShellCommand(
        shellCommand: string,
        shellArgs: string,
        envVars: Record<string, string>,
        workingDir: string
      ) {
        // Set a reasonable timeout for command execution (5 minutes)
        const timeoutMs = 5 * 60 * 1000;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        // Construct the command with environment variables
        const fullCommand = `${
          envVars
            ? Object.entries(envVars)
                .map(([key, value]) => `${key}="${value}"`)
                .join(' ') + ' '
            : ''
        }${shellCommand}${shellArgs}`;

        if (debug) {
          appendToBuffer(`[DEBUG] Executing shell command in ${workingDir}: ${fullCommand}`);
        }

        try {
          // Execute in the specified directory
          const execOptions: child_process.ExecOptions = {
            shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
            cwd: workingDir,
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large outputs
            timeout: timeoutMs, // 5 minute timeout
            env: {
              ...process.env,
              // Add any environment variables
              ...(env
                ? Object.fromEntries(
                    Object.entries(env).filter(([_, value]) => value !== undefined)
                  )
                : {}),
            },
          };

          // Create a promise that will be rejected if the timeout is reached
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error(`Command execution timed out after ${timeoutMs / 1000} seconds`));
            }, timeoutMs);
          });

          // Execute command with timeout
          const execPromise = execWithTracking(fullCommand, execOptions);
          const result = await Promise.race([execPromise, timeoutPromise]);

          // Clear the timeout if the command completes before the timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          const { stdout, stderr, exitCode } = result;

          if (stdout) {
            appendToBuffer(`COMMAND OUTPUT:\n${stdout}`);
          }

          if (stderr) {
            appendToBuffer(`COMMAND ERRORS:\n${stderr}`);
          }

          // Return successful result with both stdout and stderr if available
          return {
            success: exitCode === 0,
            output:
              stdout ||
              (exitCode === 0
                ? 'Command executed successfully with no output'
                : 'Command execution failed with exit code ' + exitCode),
            ...(stderr
              ? { error: { message: 'Warning: stderr output was present', details: { stderr } } }
              : {}),
          };
        } catch (error) {
          // Clear the timeout if it was set
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          const errorMessage = error instanceof Error ? error.message : String(error);

          cleanupAllProcesses();

          appendToBuffer(`COMMAND ERROR: ${errorMessage}`);

          // Handle specific error types with detailed information
          if (error instanceof Error) {
            const errorObj: ToolExecutionResult = {
              success: false,
              output: `Command execution failed: ${error.message}`,
              error: {
                message: error.message,
                code: 'code' in error && typeof error.code === 'number' ? error.code : undefined,
                details: {},
              },
            };

            // Handle different error scenarios
            if (error.message.includes('command not found') || error.message.includes('ENOENT')) {
              if (errorObj.error) {
                errorObj.error.details = {
                  type: 'COMMAND_NOT_FOUND',
                  suggestion: 'Ensure the command is installed and in your PATH',
                };
              }
            } else if (
              error.message.includes('permission denied') ||
              error.message.includes('EACCES')
            ) {
              if (errorObj.error) {
                errorObj.error.details = {
                  type: 'PERMISSION_DENIED',
                  suggestion: 'Check file permissions or try with appropriate privileges',
                };
              }
            } else if (error.message.includes('timed out')) {
              if (errorObj.error) {
                errorObj.error.details = {
                  type: 'TIMEOUT',
                  suggestion: `Command execution exceeded the timeout of ${timeoutMs / 1000} seconds`,
                };
              }
            } else if (error.message.includes('SIGTERM') || error.message.includes('SIGKILL')) {
              if (errorObj.error) {
                errorObj.error.details = {
                  type: 'TERMINATED',
                  suggestion: 'Command was terminated by the system',
                };
              }
            }

            return errorObj;
          }

          return {
            success: false,
            output: 'Command execution failed with unknown error',
            error: {
              message: 'Unknown error',
            },
          };
        }
      }
    },
  };
}
