import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin, ResolvedConfig } from "vite";
import { assets, ROUTE } from "./assets.ts";
import type { PosterOptions } from "./posters.ts";
import { createRunner, type Runner } from "./runner.ts";

export { ROUTE, writeScenes } from "./assets.ts";

export type { PosterOptions } from "./posters.ts";

export interface SceneModule {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly desc: string;
  readonly posters?: { readonly light: string; readonly dark: string };
}

export interface SvjeezOptions {
  readonly posters?: PosterOptions;
  readonly cacheDir?: string;
}

const QUERY = /\?svjeez(&posters)?$/;

export default function svjeez(options: SvjeezOptions = {}): Plugin {
  let config: ResolvedConfig;
  let inFilm = false;
  const runners = new Map<string, Runner>();

  return {
    name: "svjeez",
    enforce: "pre",
    configResolved(resolved) {
      config = resolved;

      // The server that `runFilm` loads a film file with may load this app's config: leave the app's settings alone.
      inFilm = resolved.plugins.some((plugin) => plugin.name === "svjeez-dom");

      if (inFilm) return;
      assets.cache = pathToFileURL(`${options.cacheDir ?? join(config.cacheDir, "svjeez")}/`);
    },
    configureServer(server) {
      if (inFilm) return;
      assets.limit = 500;

      server.middlewares.use(ROUTE, async (request, response, next) => {
        const asset = assets.files.get(
          decodeURIComponent(new URL(request.url!, "http://dev").pathname.slice(1)),
        );

        if (!asset) return next();

        try {
          const bytes = await asset.bytes();
          response.setHeader("Content-Type", asset.type);
          response.setHeader("Cache-Control", "no-store");
          response.end(bytes);
        } catch (error) {
          next(error);
        }
      });
    },
    watchChange(file) {
      for (const runner of runners.values()) runner.invalidate(file);
    },
    async load(id) {
      const query = QUERY.exec(id);

      if (!query) return;
      const file = id.slice(0, query.index);
      let runner = runners.get(this.environment.name);

      if (!runner) runners.set(this.environment.name, (runner = createRunner(config)));

      const { image, dependencies } = await runner.load(
        file,
        query[1] ? (options.posters ?? true) : false,
      );

      for (const dependency of dependencies) this.addWatchFile(dependency);
      const { src, width, height, title, desc, svg, posters } = image;

      if (config.command === "serve")
        return `export default ${JSON.stringify({ src, width, height, title, desc, posters } satisfies SceneModule)}`;

      const name = basename(file, extname(file));

      const emit = (fileName: string, source: string | Uint8Array) =>
        `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: "asset", name: fileName, source })}`;

      const still = async (url: string, scheme: string) =>
        emit(`${name}-${scheme}.webp`, await assets.files.get(url.slice(ROUTE.length))!.bytes());

      return `export default {
  src: ${emit(`${name}.svg`, svg)},
  width: ${width},
  height: ${height},
  title: ${JSON.stringify(title)},
  desc: ${JSON.stringify(desc)},
  posters: ${posters ? `{ light: ${await still(posters.light, "light")}, dark: ${await still(posters.dark, "dark")} }` : "undefined"},
};`;
    },
    async closeBundle() {
      const runner = runners.get(this.environment.name);
      runners.delete(this.environment.name);
      await runner?.close();
      await assets.close?.();
    },
  };
}
