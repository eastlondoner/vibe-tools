import type { Command, CommandGenerator } from '../../../types';
import { formatOutput, ActionError, NavigationError } from './stagehandUtils';
import { ActResult, ConstructorParams, Stagehand } from '@browserbasehq/stagehand';
import { loadConfig } from '../../../config';
import {
  loadStagehandConfig,
  validateStagehandConfig,
  getStagehandApiKey,
  getStagehandModel,
  StagehandConfig,
} from './config';
import type { SharedBrowserCommandOptions } from '../browserOptions';
import {
  setupConsoleLogging,
  setupNetworkMonitoring,
  captureScreenshot,
  outputMessages,
  setupVideoRecording,
} from '../utilsShared';
import { overrideStagehandInit, StagehandInitOverride, stagehandLogger } from './initOverride';

export type RecordVideoOptions = {
  /**, stagehandLogger
   * Path to the directory to put videos into.
   */
  dir: string;
};

overrideStagehandInit();

export class ActCommand implements Command {
  private _debug = false;
  private debug = (...args: any[]) => {
    if (this._debug) {
      console.log(...args);
    }
  };

  async *execute(query: string, options: SharedBrowserCommandOptions): CommandGenerator {
    if (!query) {
      yield 'Please provide an instruction and URL. Usage: browser act "<instruction>" --url <url>';
      return;
    }

    this._debug = options?.debug ?? false;

    const url = options?.url;
    if (!url) {
      yield 'Please provide a URL using the --url option';
      return;
    }

    // Load and validate configuration
    const config = loadConfig();
    const stagehandConfig = loadStagehandConfig(config);
    validateStagehandConfig(stagehandConfig);

    let stagehand: Stagehand | undefined;
    let consoleMessages: string[] = [];
    let networkMessages: string[] = [];

    try {
      const videoDir = await setupVideoRecording(options);

      // Get API key and set environment variables explicitly for Stagehand
      const apiKey = getStagehandApiKey({
        provider: (options.provider as StagehandConfig['provider']) ?? stagehandConfig.provider,
      });

      const config = {
        env: 'LOCAL',
        localBrowserLaunchOptions: {
          headless: options?.headless ?? stagehandConfig.headless,
          recordVideo:
            options?.video && videoDir
              ? {
                  dir: videoDir,
                }
              : undefined,
        },
        verbose: options?.debug || stagehandConfig.verbose ? 1 : 0,
        modelName: getStagehandModel(stagehandConfig, {
          model: options?.model,
          provider: options?.provider as StagehandConfig['provider'] | undefined,
        }),
        modelClientOptions: {
          apiKey: apiKey,
        },
        useAPI: false, // this stops it trying to use the browserbase api
        enableCaching: stagehandConfig.enableCaching,
        logger: stagehandLogger(options?.debug ?? stagehandConfig.verbose),
      } satisfies ConstructorParams;

      // Set default values for network and console options
      options = {
        ...options,
        network: options?.network === undefined ? true : options.network,
        console: options?.console === undefined ? true : options.console,
      };

      if (options?.debug) {
        console.log('using stagehand config', {
          ...config,
          modelClientOptions: { ...config.modelClientOptions, apiKey: 'REDACTED' },
        });
      }
      stagehand = new Stagehand(config);

      const timeouts: ReturnType<typeof setTimeout>[] = [];

      await using _stagehand = {
        [Symbol.asyncDispose]: async () => {
          console.error('closing stagehand, this can take a while');
          await Promise.race([
            options?.connectTo ? undefined : stagehand?.page.close(),
            stagehand?.close(),
            new Promise((_, reject) =>
              timeouts.push(setTimeout(() => reject(new Error('Page close timeout')), 5000))
            ),
          ]);
          console.error('stagehand closed');
        },
      };

      // Initialize with timeout
      const initOptions: StagehandInitOverride = {
        recordVideo:
          options?.video && videoDir
            ? {
                dir: videoDir,
              }
            : undefined,
        connectTo: options?.connectTo,
        viewport: options?.viewport,
      };
      // @ts-expect-error
      const initPromise = stagehand.init(initOptions);
      const initTimeoutPromise = new Promise((_, reject) =>
        timeouts.push(setTimeout(() => reject(new Error('Initialization timeout')), 30000))
      );
      await Promise.race([initPromise, initTimeoutPromise]);

      for (const timeout of timeouts) {
        clearTimeout(timeout);
      }
      timeouts.length = 0;

      // Setup console and network monitoring
      consoleMessages = await setupConsoleLogging(stagehand.page, options || {});
      networkMessages = await setupNetworkMonitoring(stagehand.page, options || {});

      try {
        // Skip navigation if url is 'current' or if current URL matches target URL
        if (url !== 'current') {
          const currentUrl = await stagehand.page.url();
          if (currentUrl !== url) {
            // Navigate with timeout
            const gotoPromise = stagehand.page.goto(url);
            const gotoTimeoutPromise = new Promise((_, reject) =>
              timeouts.push(
                setTimeout(
                  () => reject(new Error('Navigation timeout')),
                  stagehandConfig.timeout ?? 30000
                )
              )
            );
            await Promise.race([gotoPromise, gotoTimeoutPromise]);
            for (const timeout of timeouts) {
              clearTimeout(timeout);
            }
            timeouts.length = 0;
          } else {
            console.log('Skipping navigation - already on correct page');
          }
        } else {
          console.log('Skipping navigation - using current page');
        }
      } catch (error) {
        throw new NavigationError(
          `Failed to navigate to ${url}. Please check if the URL is correct and accessible.`,
          error
        );
      }

      const result = await this.performAction(
        stagehand,
        { instruction: query, evaluate: options?.evaluate },
        options?.timeout ?? stagehandConfig.timeout
      );

      // Take screenshot if requested
      await captureScreenshot(stagehand.page, options);

      // Output result and messages
      yield formatOutput(result, options?.debug);
      for (const message of outputMessages(consoleMessages, networkMessages, options)) {
        yield message;
      }

      // Output HTML content if requested
      if (options?.html) {
        const htmlContent = await stagehand.page.content();
        yield '\n--- Page HTML Content ---\n\n';
        yield htmlContent;
        yield '\n--- End of HTML Content ---\n';
      }

      if (options?.screenshot) {
        yield `Screenshot saved to ${options.screenshot}\n`;
      }
    } catch (error) {
      console.error('error in stagehand loop', error);
      throw error;
    }
  }

  private async performAction(
    stagehand: Stagehand,
    {
      instruction,
      evaluate,
    }: {
      instruction: string;
      evaluate?: string;
    },
    timeout = 120000
  ): Promise<string> {
    try {
      let totalTimeout: ReturnType<typeof setTimeout> | undefined;
      const totalTimeoutPromise = new Promise(
        (_, reject) =>
          (totalTimeout = setTimeout(() => reject(new Error('Action timeout')), timeout))
      );

      if (evaluate) {
        await Promise.race([stagehand.page.evaluate(evaluate), totalTimeoutPromise]);
      }

      // Perform action with timeout
      for (const instruct of instruction.split('|')) {
        console.log('performing step', instruct);
        let stepTimeout: ReturnType<typeof setTimeout> | undefined;
        const stepTimeoutPromise = new Promise((_, reject) => {
          stepTimeout = setTimeout(() => reject(new Error('step timeout')), 90000);
        });
        const actPromise = stagehand.page.observe(instruct).then(async (r) => {
          const results: ActResult[] = [];
          if (r.length === 0) {
            throw new Error(
              `Unable to determine how to carry out the action ${instruction} on the current page. Please try again with a more specific instruction.`
            );
          }
          for (const observation of r) {
            this.debug('Acting on observation', observation);
            const stepResult = await stagehand.page.act(observation);
            results.push(stepResult);
          }
          return results;
        });
        const result = await Promise.race([actPromise, totalTimeoutPromise, stepTimeoutPromise]);
        console.log('step result', result);

        if (stepTimeout !== undefined) {
          clearTimeout(stepTimeout);
        }
      }

      // Wait for potential navigation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get the current URL after the action
      const endUrl = await stagehand.page.url();

      if (totalTimeout) {
        clearTimeout(totalTimeout);
      }

      return `Successfully performed action: ${instruction} (final url ${endUrl})`;
    } catch (error) {
      console.error('error in stagehand step', error);
      if (error instanceof Error) {
        throw new ActionError(`${error.message} Failed to perform action: ${instruction}`, {
          instruction,
          error,
          availableElements: await stagehand.page.$$eval(
            'a, button, [role="button"], input, select, textarea',
            (elements: Element[]) =>
              elements.map((el) => ({
                text: el.textContent?.trim(),
                ariaLabel: el.getAttribute('aria-label'),
                role: el.getAttribute('role'),
                tag: el.tagName.toLowerCase(),
              }))
          ),
        });
      }
      throw error;
    }
  }
}
