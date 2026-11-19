import type { HTMLBundle } from "bun";
import { hashPage } from "./hash.ts";
import type { Target } from "./target.ts";

export interface ServeOptions {
  /** The element to capture, as a CSS selector. */
  readonly selector: string;
  /** The port. Default: any free one. */
  readonly port?: number;
}

/**
 * Serves a Bun HTML import (`import index from "./index.html"`) as a `film` target.
 * `sources()` hashes the page and every asset it references, as Bun bundled them.
 */
export const serve = (html: HTMLBundle, { selector, port = 0 }: ServeOptions): Target => {
  const server = Bun.serve({
    port,
    routes: { "/": html },
    // Development mode breaks CSS modules in Bun 1.4.3 (`import_X_module is not defined`).
    development: false,
  });

  const url = `http://localhost:${server.port}/`;

  return {
    url,
    selector,
    sources: () => hashPage(url),
    close: () => server.stop(true),
  };
};
