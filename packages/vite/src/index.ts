import { createHash } from "node:crypto";
import { basename, extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { settings } from "@svjeez/og/settings";
import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { assets, ROUTE } from "./assets.ts";
import type { PosterOptions } from "./posters.ts";
import { createRunner, type Runner } from "./runner.ts";
import type { Poster, SceneModule } from "./scene.ts";

export { ROUTE, writeScenes } from "./assets.ts";

export type { PosterOptions } from "./posters.ts";

export type { RenderOptions as StillOptions } from "@svjeez/og/render";

export type { Poster, SceneModule } from "./scene.ts";

export interface SvjeezOptions {
  readonly posters?: PosterOptions;
  readonly cacheDir?: string;
}

/** A prefix for an inline scene that names none: letters and digits from where the file is, so two inline scenes never share one. */
const hash = (path: string) => `s${createHash("sha256").update(path).digest("hex").slice(0, 8)}`;

const QUERY = /\?svjeez(&posters)?(&inline)?$/;

export default function svjeez(options: SvjeezOptions = {}): Plugin {
  let config: ResolvedConfig;
  let inFilm = false;
  const runners = new Map<string, Runner>();
  let devServer: ViteDevServer | undefined;
  const feeds = new Map<string, Set<string>>();

  return {
    name: "svjeez",
    enforce: "pre",
    configResolved(resolved) {
      config = resolved;

      inFilm = resolved.plugins.some((plugin) => plugin.name === "svjeez-dom");

      if (inFilm) return;
      settings.cache = pathToFileURL(`${options.cacheDir ?? join(config.cacheDir, "svjeez")}/`);
    },
    configureServer(dev) {
      if (inFilm) return;
      devServer = dev;
      assets.limit = settings.limit = 500;

      dev.middlewares.use(ROUTE, async (request, response, next) => {
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
      const ids = feeds.get(file);

      if (!devServer || !ids) return;

      for (const environment of Object.values(devServer.environments))
        for (const id of ids) {
          const node = environment.moduleGraph.getModuleById(id);

          if (node) environment.moduleGraph.invalidateModule(node);
        }

      devServer.ws.send({ type: "full-reload" });
    },
    async load(id) {
      const query = QUERY.exec(id);

      if (!query) return;
      const file = id.slice(0, query.index);
      let runner = runners.get(this.environment.name);

      if (!runner) runners.set(this.environment.name, (runner = createRunner(config)));

      const inline = query[2] !== undefined;

      const { image, dependencies } = await runner.load(
        file,
        query[1] ? (options.posters ?? true) : false,
        inline ? hash(relative(config.root, file)) : undefined,
      );

      for (const dependency of dependencies) {
        if (!devServer) {
          this.addWatchFile(dependency);
          continue;
        }

        devServer.watcher.add(dependency);
        feeds.set(dependency, (feeds.get(dependency) ?? new Set()).add(id));
      }

      const { src, width, height, title, desc, svg, posters } = image;
      const server = this.environment.config.consumer === "server" || inline;

      if (config.command === "serve")
        return `export default ${JSON.stringify({ src, width, height, title, desc, posters, ...(server && { svg }) } satisfies SceneModule)}`;

      const name = basename(file, extname(file));

      const emit = (fileName: string, source: string | Uint8Array) =>
        `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: "asset", name: fileName, source })}`;

      const still = async ({ src: url, width: wide }: Poster, scheme: string) =>
        `{ src: ${emit(`${name}-${scheme}-${wide}.webp`, await assets.files.get(url.slice(ROUTE.length))!.bytes())}, width: ${wide} }`;

      const stills = async (list: readonly Poster[], scheme: string) =>
        `[${(await Promise.all(list.map((one) => still(one, scheme)))).join(", ")}]`;

      return `export default {
  src: ${emit(`${name}.svg`, svg)},
  width: ${width},
  height: ${height},
  title: ${JSON.stringify(title)},
  desc: ${JSON.stringify(desc)},
  posters: ${posters ? `{ light: ${await stills(posters.light, "light")}, dark: ${await stills(posters.dark, "dark")} }` : "undefined"},${server ? `\n  svg: ${JSON.stringify(svg)},` : ""}
};`;
    },
    async closeBundle() {
      const runner = runners.get(this.environment.name);
      runners.delete(this.environment.name);
      await runner?.close();
    },
  };
}
