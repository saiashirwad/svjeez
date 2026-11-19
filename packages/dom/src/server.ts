/** A running web app for `film` to open. `serve` from `@svjeez/dom/bun` and `@svjeez/dom/vite` make one. */
export interface DomServer {
  /** Where the page is. */
  readonly url: string;
  /** A hash of the app's source as it is now: `film` re-records when it changes. */
  sources(): Promise<string>;
  /** Stops the server. */
  close(): Promise<void>;
}
