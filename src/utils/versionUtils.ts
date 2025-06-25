import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import consola from 'consola';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface VersionInfo {
  current: string;
  latest: string | null;
  isOutdated: boolean;
}

/**
 * Gets the currently installed version of vibe-tools by searching upwards
 * for a package.json file with the name "vibe-tools".
 */
export function getCurrentVersion(): string {
  let currentDir = __dirname;
  let attempts = 0;
  const maxAttempts = 5; // Prevent infinite loops

  while (attempts < maxAttempts) {
    const packageJsonPath = join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);

        if (packageJson.name === 'vibe-tools') {
          consola.debug('Found vibe-tools package.json at:', packageJsonPath);
          return packageJson.version;
        }
      } catch (error) {
        // Ignore errors reading/parsing intermediate package.json files
        consola.debug('Error reading/parsing intermediate package.json:', packageJsonPath, error);
      }
    }

    const parentDir = resolve(currentDir, '..');
    // Stop if we have reached the root directory
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
    attempts++;
  }

  consola.error('Could not find vibe-tools package.json by searching upwards from', __dirname);
  return '0.0.0'; // Fallback version
}

/**
 * Gets the latest available version of vibe-tools from the NPM registry.
 * Uses `npm view vibe-tools version`.
 */
export async function getLatestVersion(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('npm view vibe-tools version');
    return stdout.trim();
  } catch (error) {
    consola.warn('Failed to fetch latest version from NPM:', error);
    return null; // Indicate failure to fetch
  }
}

/**
 * Compare two semantic version strings
 * Returns:
 * - 1 if version1 > version2
 * - 0 if version1 = version2
 * - -1 if version1 < version2
 */
export function compareVersions(version1: string, version2: string): number {
  if (version1 === version2) return 0;

  const [v1Major, v1Minor, v1PatchAndMore] = version1.split('.');
  const v1Patch = v1PatchAndMore?.split('-')[0] || '0';

  const [v2Major, v2Minor, v2PatchAndMore] = version2.split('.');
  const v2Patch = v2PatchAndMore?.split('-')[0] || '0';

  const v1Parts = [parseInt(v1Major || '0'), parseInt(v1Minor || '0'), parseInt(v1Patch || '0')];
  const v2Parts = [parseInt(v2Major || '0'), parseInt(v2Minor || '0'), parseInt(v2Patch || '0')];

  for (let i = 0; i < 3; i++) {
    if (v1Parts[i] > v2Parts[i]) return 1;
    if (v1Parts[i] < v2Parts[i]) return -1;
  }

  return 0;
}

/**
 * Check if version1 is newer than or equal to version2
 */
export function isVersionNewerOrEqual(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) >= 0;
}

/**
 * Checks if the currently installed version is outdated compared to the latest NPM version.
 * Note: This uses simple string comparison. For robust comparison (e.g., handling pre-releases),
 * a library like 'semver' would be better, but sticking to simplicity for now.
 */
export async function checkPackageVersion(): Promise<VersionInfo> {
  try {
    const current = getCurrentVersion();
    // If we couldn't even get the current version, don't proceed with check/update
    if (current === '0.0.0') {
      consola.warn('Could not determine current package version. Skipping update check.');
      return { current: '0.0.0', latest: null, isOutdated: false };
    }

    const latest = await getLatestVersion();

    if (latest) {
      // Use the new version comparison utility
      const isOutdated = compareVersions(current, latest) < 0;

      return {
        current,
        latest,
        isOutdated,
      };
    } else {
      consola.warn('Could not determine latest package version. Skipping update check.');
      return { current, latest: null, isOutdated: false };
    }
  } catch (error) {
    consola.warn('Error checking package version:', error);
    return {
      current: '0.0.0', // Ensure fallback on any check error
      latest: null,
      isOutdated: false,
    };
  }
}
