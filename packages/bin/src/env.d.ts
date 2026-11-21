declare module "*.pack" {
  /** The file's path: inside the binary once compiled, on disk when run from source. */
  const path: string;
  export default path;
}

declare module "playwright-core/lib/coreBundle" {
  /** playwright-core's browser registry, the part of its internal bundle that installs browsers. */
  export const registry: {
    readonly installBrowsersForNpmInstall: (browsers: readonly string[]) => Promise<void>;
    readonly runOopDownloadBrowserMain: () => void;
  };
}
