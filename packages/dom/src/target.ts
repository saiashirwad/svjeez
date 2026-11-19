/**
 * What `film` opens: a page, and the element on it to capture.
 * `serve` (an app) and `component` (one mounted component) from `@svjeez/dom/bun` and `@svjeez/dom/vite` make one.
 *
 * `Props` is what `update()` takes in the film script: `never` for an app, the component's wire props for a component.
 */
export interface Target<Props = never> {
  /** Where the page is. */
  readonly url: string;
  /** The element to capture, as a CSS selector. */
  readonly selector: string;
  /** A hash of the page's source as it is now: `film` re-records when it changes. */
  sources(): Promise<string>;
  /** Stops the server (or unregisters the page). */
  close(): Promise<void>;
  /** Type-only: the props `update()` accepts. Never set at runtime. */
  readonly props?: Props;
}
