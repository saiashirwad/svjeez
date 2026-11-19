import { createHash } from "node:crypto";
import type { HTMLBundle } from "bun";
import type { DomServer } from "./server.ts";

export interface ServeOptions {
  /** The port. Default: any free one. */
  readonly port?: number;
}

const REFERENCE = /\b(?:src|href)="([^"#]+)"/g;

/**
 * Serves a Bun HTML import (`import index from "./index.html"`) for `film`.
 * `sources()` hashes the page and every asset it references, as Bun bundled them.
 */
export const serve = (html: HTMLBundle, { port = 0 }: ServeOptions = {}): DomServer => {
  const server = Bun.serve({
    port,
    routes: { "/": html },
    // Development mode breaks CSS modules in Bun 1.4.3 (`import_X_module is not defined`).
    development: false,
  });

  const url = `http://localhost:${server.port}/`;

  return {
    url,
    sources: async () => {
      const page = await (await fetch(url)).text();
      const hash = createHash("sha256").update(page);

      for (const [, reference] of page.matchAll(REFERENCE)) {
        const asset = new URL(reference!, url);

        if (asset.origin === new URL(url).origin)
          hash.update(Buffer.from(await (await fetch(asset)).arrayBuffer()));
      }

      return hash.digest("hex");
    },
    close: () => server.stop(true),
  };
};
