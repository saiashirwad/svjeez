// A Vite plugin for svjeez scenes. Import a scene's .tsx with `?svjeez` and get its URL and size. The scene compiles in
// Node while the app builds, so the browser bundle never holds svjeez or the scene's code. `?svjeez&posters` adds a still
// frame per color scheme, which needs playwright-core and a Chromium build. The dev server serves every file under
// /_svjeez/, and the build emits each one as an asset.
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Plugin, ResolvedConfig } from "vite";
import { assets, ROUTE } from "./assets.ts";
import type { PosterOptions } from "./posters.ts";
import { createRunner, type Runner } from "./runner.ts";

export { ROUTE, writeScenes } from "./assets.ts";
export type { PosterOptions } from "./posters.ts";

/** What a `?svjeez` import gives. */
export interface SceneModule {
  /** The SVG's URL. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** The SVG's <title> and <desc>, for alt text. */
  readonly title: string;
  readonly desc: string;
  /** A still frame per color scheme, for `?svjeez&posters`. */
  readonly posters?: { readonly light: string; readonly dark: string };
}

export interface Options {
  /** How `?svjeez&posters` renders its stills. */
  readonly posters?: PosterOptions;
  /** Where posters are kept between runs. Default `svjeez/` in Vite's cache directory. */
  readonly cacheDir?: string;
}

const QUERY = /\?svjeez(&posters)?$/;

export default function svjeez(options: Options = {}): Plugin {
  let config: ResolvedConfig;
  // One runner per environment, since a build closes each environment on its own.
  const runners = new Map<string, Runner>();
  return {
    name: "svjeez",
    enforce: "pre",
    configResolved(resolved) {
      config = resolved;
      assets.cache = pathToFileURL(`${options.cacheDir ?? join(config.cacheDir, "svjeez")}/`);
    },
    configureServer(server) {
      server.middlewares.use(ROUTE, async (request, response, next) => {
        const asset = assets.files.get(decodeURIComponent(new URL(request.url!, "http://dev").pathname.slice(1)));
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
      const { image, dependencies } = await runner.load(file, query[1] ? (options.posters ?? true) : false);
      for (const dependency of dependencies) this.addWatchFile(dependency);
      const { src, width, height, title, desc, svg, posters } = image;
      if (config.command === "serve") return `export default ${JSON.stringify({ src, width, height, title, desc, posters } satisfies SceneModule)}`;

      // A build emits each file, and Vite names it and writes its URL.
      const name = basename(file, extname(file));
      const emit = (fileName: string, source: string | Uint8Array) => `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: "asset", name: fileName, source })}`;
      const still = async (url: string, scheme: string) => emit(`${name}-${scheme}.webp`, await assets.files.get(url.slice(ROUTE.length))!.bytes());
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
