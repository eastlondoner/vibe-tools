// Type declarations for internal Playwright modules
// These are not part of the public API but we need them for browser installation

declare module 'playwright-core/lib/server/registry/index' {
  export function installBrowsersForNpmInstall(browsers: string[]): Promise<void>;
  export const registry: {
    findExecutable(name: string): any;
    install(executables: any[], forceReinstall?: boolean): Promise<void>;
  };
  export function registryDirectory(): string;
  export function browserDirectoryToMarkerFilePath(browserDirectory: string): string;
  export function buildPlaywrightCLICommand(sdkLanguage: string, parameters: string): string;
  export function findChromiumChannel(sdkLanguage: string): string | null;
}
