import { platform, homedir } from 'node:os';
import { join } from 'node:path';
import { promises as fs, existsSync } from 'node:fs';
import type { Command, CommandGenerator } from '../../types';
import { execAsync } from '../../utils/execAsync';
import type { MacChromeCommandOptions } from './browserOptions';

export class MacChromeCommand implements Command {
  private async discoverChromeProfiles(): Promise<Array<{ profile: string; email: string }>> {
    const CHROME_DIR = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
    const profiles: Array<{ profile: string; email: string }> = [];

    try {
      // Check Default profile
      const defaultDir = join(CHROME_DIR, 'Default');
      if (existsSync(defaultDir)) {
        const email = await this.getProfileEmail(defaultDir);
        profiles.push({ profile: 'Default', email });
      }

      // Check Profile* directories
      const chromeContents = await fs.readdir(CHROME_DIR);
      for (const item of chromeContents) {
        if (item.startsWith('Profile ')) {
          const profileDir = join(CHROME_DIR, item);
          const stat = await fs.stat(profileDir);
          if (stat.isDirectory()) {
            const email = await this.getProfileEmail(profileDir);
            profiles.push({ profile: item, email });
          }
        }
      }
    } catch {
      // Chrome directory doesn't exist or can't be read
    }

    return profiles;
  }

  private async getProfileEmail(profileDir: string): Promise<string> {
    try {
      const preferencesPath = join(profileDir, 'Preferences');
      if (!existsSync(preferencesPath)) {
        return '(no email found)';
      }

      const preferences = await fs.readFile(preferencesPath, 'utf-8');
      const emailMatch = preferences.match(/"email":\s*"([^"]+)"/);
      return emailMatch ? emailMatch[1] : '(no email found)';
    } catch {
      return '(no email found)';
    }
  }

  private async copyProfile(sourceProfile: string, tempDir: string): Promise<void> {
    const CHROME_DIR = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
    const sourceDir = join(CHROME_DIR, sourceProfile);

    if (!existsSync(sourceDir)) {
      throw new Error(`Profile ${sourceProfile} not found`);
    }

    // Copy essential Chrome files
    const filesToCopy = ['Local State', 'Secure Preferences', 'First Run', 'Consent To Send Stats'];
    for (const file of filesToCopy) {
      const sourcePath = join(CHROME_DIR, file);
      const destPath = join(tempDir, file);
      try {
        if (existsSync(sourcePath)) {
          await fs.copyFile(sourcePath, destPath);
        }
      } catch {
        // Skip files that can't be copied
      }
    }

    // Copy component_crx_cache directory if it exists
    const componentCacheSource = join(CHROME_DIR, 'component_crx_cache');
    const componentCacheDest = join(tempDir, 'component_crx_cache');
    try {
      if (existsSync(componentCacheSource)) {
        await fs.cp(componentCacheSource, componentCacheDest, { recursive: true });
      }
    } catch {
      // Skip if can't copy
    }

    // Copy the selected profile
    const profileDestDir = join(tempDir, sourceProfile);
    await fs.cp(sourceDir, profileDestDir, { recursive: true });
  }

  private async checkPortInUse(port: number): Promise<{ inUse: boolean; processInfo?: string }> {
    try {
      const { stdout } = await execAsync(`lsof -i :${port}`);
      if (stdout.trim()) {
        // Parse lsof output to get process information
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          // Skip header line
          const processLine = lines[1];
          const parts = processLine.split(/\s+/);
          const command = parts[0];
          const pid = parts[1];
          const user = parts[2];
          return {
            inUse: true,
            processInfo: `${command} (PID: ${pid}, User: ${user})`,
          };
        }
      }
      return { inUse: false };
    } catch {
      // lsof command failed or port not in use
      return { inUse: false };
    }
  }

  private async verifyChromeIsRunning(
    port: number
  ): Promise<{ running: boolean; processInfo?: string }> {
    try {
      const { stdout } = await execAsync(`lsof -i :${port}`);
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          const processLine = lines[1];
          const parts = processLine.split(/\s+/);
          const command = parts[0];
          const pid = parts[1];

          // Additional check: verify the process is actually Chrome
          if (
            command.toLowerCase().includes('chrome') ||
            command.toLowerCase().includes('google')
          ) {
            return {
              running: true,
              processInfo: `${command} (PID: ${pid})`,
            };
          }
        }
      }
      return { running: false };
    } catch {
      return { running: false };
    }
  }

  private async wait(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  async *execute(query: string, options: MacChromeCommandOptions): CommandGenerator {
    if (query.trim() !== '') {
      throw new Error(
        'This command does not accept a query. Supported options are --start-url, --copy-default-profile, --copy-profile and --lite'
      );
    }

    if (platform() !== 'darwin') {
      yield 'Error: This command is only supported on macOS.';
      return;
    }

    const TMP_DIR = join(process.env.HOME || '/tmp', 'chrome-debug-profile');
    const REMOTE_PORT = 9222;
    const startUrl = options.startUrl || 'https://github.com';

    // Check if the debug port is already in use
    yield `Checking if port ${REMOTE_PORT} is available...`;
    const portCheck = await this.checkPortInUse(REMOTE_PORT);
    if (portCheck.inUse) {
      throw new Error(
        `Port ${REMOTE_PORT} is already in use by process: ${portCheck.processInfo}. Please close the existing process or use a different port.`
      );
    }
    yield `Port ${REMOTE_PORT} is available.`;

    yield `Cleaning temporary profile ${TMP_DIR}...`;
    try {
      await fs.rm(TMP_DIR, { recursive: true, force: true });
      await fs.mkdir(TMP_DIR, { recursive: true });
      yield `Temporary profile directory created at ${TMP_DIR}.`;
    } catch (error) {
      yield `Warning: Could not clean temporary directory: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Handle profile copying options
    if (options.copyDefaultProfile) {
      yield `Copying default Chrome profile...`;
      try {
        await this.copyProfile('Default', TMP_DIR);
        yield `Default profile copied successfully.`;
      } catch (error) {
        yield `Warning: Could not copy default profile: ${error instanceof Error ? error.message : 'Unknown error'}`;
        yield `Continuing with temporary profile.`;
      }
    } else if (options.copyProfile) {
      yield `Looking for Chrome profile with email: ${options.copyProfile}...`;
      try {
        const profiles = await this.discoverChromeProfiles();
        const matchingProfile = profiles.find((p) =>
          p.email.toLowerCase().includes(options.copyProfile!.toLowerCase())
        );

        if (matchingProfile) {
          yield `Found profile: ${matchingProfile.profile} (${matchingProfile.email})`;
          yield `Copying profile...`;
          await this.copyProfile(matchingProfile.profile, TMP_DIR);
          yield `Profile copied successfully.`;
        } else {
          yield `Profile with email "${options.copyProfile}" not found.`;
          yield `Available profiles:`;
          for (const profile of profiles) {
            yield `  - ${profile.profile}: ${profile.email}`;
          }
          yield `Continuing with temporary profile.`;
        }
      } catch (error) {
        yield `Warning: Could not copy profile: ${error instanceof Error ? error.message : 'Unknown error'}`;
        yield `Continuing with temporary profile.`;
      }
    }
    const selectedProfile = options.copyDefaultProfile
      ? 'Default'
      : options.copyProfile || 'Default';

    const liteFlags = [
      `--remote-debugging-port=${REMOTE_PORT}`,
      `--user-data-dir=${TMP_DIR}`,
      `--profile-directory=${selectedProfile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-search-engine-choice-screen',
    ];

    const fullFlags = [
      '--disable-field-trial-config',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate,HttpsUpgrades,PaintHolding,PlzDedicatedWorker',
      '--allow-pre-commit-input',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--enable-automation',
      '--no-service-autorun',
      '--export-tagged-pdf',
      '--unsafely-disable-devtools-self-xss-warnings',
      '--enable-logging',
      '--v=3',
      `--log-file=${process.cwd()}/chrome_debug.log`,
      `--crash-dumps-dir=${process.cwd()}/chrome_crash_reports`,
    ];

    // Pick which flag set to use
    const selectedFlags = options.lite ? liteFlags : [...liteFlags, ...fullFlags];

    if (options.lite && options.debug) {
      yield 'ℹ️  Running in --lite mode (reduced Chrome flags)';
    }

    const flags = [...selectedFlags, startUrl].join(' ');

    const command = `open -a "Google Chrome" --args ${flags}`;

    yield `Launching Chrome with remote debugging...`;
    if (options.debug) {
      yield `Command: ${command}`;
    }

    try {
      const { stdout, stderr } = await execAsync(command);
      if (stdout) yield `stdout: ${stdout}`;
      if (stderr) yield `stderr: ${stderr}`;

      yield `Chrome launch command completed. Waiting 3 seconds for Chrome to initialize...`;
      await this.wait(3);

      // Verify Chrome is actually running and listening on the debug port
      yield `Verifying Chrome is running and listening on port ${REMOTE_PORT}...`;
      const verification = await this.verifyChromeIsRunning(REMOTE_PORT);

      if (!verification.running) {
        throw new Error(
          `Chrome failed to start properly or is not listening on port ${REMOTE_PORT}. Please check the Chrome debug logs at ${process.cwd()}/chrome_debug.log for more details.`
        );
      }

      yield `✓ Chrome is running successfully: ${verification.processInfo}`;
      yield `✓ Chrome is listening on port ${REMOTE_PORT}`;
      yield `You can now connect to it using Playwright: chromium.connectOverCDP('http://localhost:${REMOTE_PORT}')`;
      yield `Debug logs will be written to: ${process.cwd()}/chrome_debug.log`;
      yield `Crash dumps (if any) will be written to: ${process.cwd()}/chrome_crash_reports`;
    } catch (error: any) {
      yield `Failed to launch Chrome: ${error.message || error}`;
      if (error.code === 'ENOENT') {
        yield 'Chrome not found. Please ensure Google Chrome.app is installed in your /Applications directory.';
      }
    }
  }
}
