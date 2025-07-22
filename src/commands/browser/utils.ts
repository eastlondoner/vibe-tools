import { consola } from 'consola';
import { once } from '../../utils/once';

/**
 * Checks if Playwright is available and returns its version information
 * @returns Object containing availability status and version info
 */
export async function checkPlaywright(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  try {
    // Try to dynamically import playwright
    const playwright = await import('playwright');
    if (!playwright) {
      return { available: false, error: 'Playwright package not found' };
    }

    // Get Playwright version by checking if it's installed
    try {
      // This will throw if playwright is not installed
      await import('playwright');
      return { available: true, version: 'installed' };
    } catch (importError) {
      if (importError instanceof Error) {
        if (importError.message.includes('Cannot find package')) {
          return {
            available: false,
            error: 'Playwright is not installed. Please install it using: npm install playwright',
          };
        }
        return { available: false, error: importError.message };
      }
      return { available: false, error: 'Unknown error while importing Playwright' };
    }
  } catch (error) {
    // Handle different types of errors
    if (error instanceof Error) {
      if (error.message.includes('Cannot find package')) {
        return {
          available: false,
          error: 'Playwright is not installed. Please install it using: npm install playwright',
        };
      }
      return { available: false, error: error.message };
    }
    return { available: false, error: 'Unknown error while checking Playwright' };
  }
}

/**
 * Ensures Playwright is available before proceeding
 * @returns true if Playwright is available, throws error if not
 */
export const ensurePlaywright = once(async (): Promise<boolean> => {
  const { available, version, error } = await checkPlaywright();

  if (!available) {
    throw new Error(
      `Playwright is required for browser commands but is not available.\n` +
        `Error: ${error}\n` +
        `Please install Playwright using one of these commands:\n` +
        `  npm install playwright\n` +
        `  yarn add playwright\n` +
        `  pnpm add playwright`
    );
  }

  if (version) {
    console.log(`Using Playwright: ${version}`);
  }
  return true;
});

/**
 * Ensures Playwright browsers (specifically Chromium) are installed
 * Uses the programmatic API to avoid version mismatches
 * @returns true if installation was successful, false otherwise
 */
export const ensurePlaywrightBrowsers = once(async (): Promise<boolean> => {
  try {
    consola.start('Installing Playwright Chromium browser (one-time setup)...');

    // Import the programmatic installation function from playwright-core
    const { installBrowsersForNpmInstall } = await import(
      'playwright-core/lib/server/registry/index'
    );

    // Install only Chromium using the exact Playwright version that vibe-tools depends on
    await installBrowsersForNpmInstall(['chromium', 'chromium-headless-shell']);

    consola.success('Playwright Chromium browser installed successfully.');
    return true;
  } catch (error) {
    console.error('Error installing Playwright Chromium browser:', error);
    consola.warn('Playwright browser installation failed; browser commands may not work.');
    consola.warn(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
});
