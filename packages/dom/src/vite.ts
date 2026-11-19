import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { InlineConfig, ViteDevServer } from "vite";
import type { DomServer } from "./server.ts";

export interface ServeOptions {
  /** The Vite project: where `index.html` and the config live. */
  readonly root: string;
  /** Extra Vite config, merged over the project's own. */
  readonly config?: InlineConfig;
  /** The HTML entry, relative to `root`. Default `index.html`. */
  readonly entry?: string;
}

const REFERENCE = /\b(?:src|href)="(\/?[^":#]+\.(?:[mc]?[jt]sx?|css))"/g;

/**
 * Starts a Vite dev server for `film`.
 * `sources()` hashes the entry HTML and every project module it imports (node_modules excluded), wherever they live.
 */
export const serve = async ({
  root,
  config,
  entry = "index.html",
}: ServeOptions): Promise<DomServer> => {
  const { createServer } = await import("vite").catch(() => {
    throw new Error("serve from @svjeez/dom/vite needs vite. Install it with `npm i -D vite`.");
  });

  const server: ViteDevServer = await createServer({
    root,
    logLevel: "warn",
    ...config,
    server: { ...config?.server, port: 0, strictPort: true, hmr: false, watch: null },
  });

  try {
    await server.listen();

    const origin = server.resolvedUrls?.local[0];

    if (!origin) throw new Error("serve: Vite did not report a local URL.");

    const html = await readFile(join(root, entry), "utf8");
    const files = new Set([join(root, entry)]);
    const queue = [...html.matchAll(REFERENCE)].map(([, reference]) => reference!);
    const seen = new Set(queue);

    // Walking the graph transforms every module, which also settles dependency optimization before the browser loads.
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      await server.transformRequest(url);

      const module = await server.moduleGraph.getModuleByUrl(url);

      if (module?.file && !module.file.includes("/node_modules/")) files.add(module.file);

      for (const next of module?.importedModules ?? [])
        if (next.file && !next.file.includes("/node_modules/") && !seen.has(next.url)) {
          seen.add(next.url);
          queue.push(next.url);
        }
    }

    return {
      url: new URL(entry === "index.html" ? "/" : entry, origin).href,
      sources: async () => {
        const hash = createHash("sha256");

        for (const file of [...files].sort()) hash.update(file).update(await readFile(file));

        return hash.digest("hex");
      },
      close: () => server.close(),
    };
  } catch (error) {
    await server.close();

    throw error;
  }
};
