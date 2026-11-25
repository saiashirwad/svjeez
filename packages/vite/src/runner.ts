import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createRunnableDevEnvironment,
  defaultServerConditions,
  resolveConfig,
  type EnvironmentModuleNode,
  type PluginOption,
  type ResolvedConfig,
  type RunnableDevEnvironment,
} from "vite";
import type { PosterOptions } from "./posters.ts";
import type { SceneImage, SceneSource } from "./scene.ts";

export interface Runner {
  load(
    file: string,
    posters: boolean | PosterOptions,
    /** The prefix for an inline scene that exports none of its own. */
    inlinePrefix?: string,
  ): Promise<{ image: SceneImage; dependencies: string[] }>;
  invalidate(file: string): void;
  close(): Promise<void>;
}

const SCENE = fileURLToPath(new URL("./scene", import.meta.url));
const RUN_FILM = fileURLToPath(new URL("./film", import.meta.url));
const TYPEGPU = fileURLToPath(new URL("./typegpu", import.meta.url));

/** What unplugin-typegpu's Vite entry exports: a function that makes the plugin. */
type MakePlugin = () => PluginOption;

const isMaker = (value: MakePlugin | { readonly default: MakePlugin }): value is MakePlugin =>
  typeof value === "function";

/**
 * unplugin-typegpu's Vite plugin, as the app at `root` has it installed beside typegpu, which compiles the `"use gpu"`
 * functions of a scene's <Shader>; none in an app without them.
 */
const typegpu = async (root: string): Promise<PluginOption[]> => {
  const require = createRequire(join(root, "package.json"));

  const found = (name: string) => {
    try {
      return require.resolve(name);
    } catch {
      return undefined;
    }
  };

  const entry = found("typegpu") && found("unplugin-typegpu/vite");

  if (!entry) return [];

  const { default: loaded }: { default: MakePlugin | { default: MakePlugin } } = await import(
    /* @vite-ignore */ pathToFileURL(entry).href
  );

  // The path is the one `require` takes, which can be the package's CommonJS build: its function is then on `default`.
  return [isMaker(loaded) ? loaded() : loaded.default()];
};

/** A file that imports `@svjeez/dom/vite` is a film: `runFilm` loads it through its own project's Vite config. */
const FILM = /\bfrom\s*["']@svjeez\/dom\/vite["']/;

interface Filmed {
  readonly scene: Promise<{ svg: string; files: readonly string[] }>;
  files?: readonly string[];
}

/** Films by file, shared by every environment's runner: a film is slow, so the client and the server get one. */
const films = new Map<string, Filmed>();

/**
 * `load` imports `@svjeez/dom/vite` through the plugin's own runner: this plugin may itself have been loaded by a module
 * runner (an Astro config that compiles the workspace's sources) that is closed by the time a film is imported.
 */
const film = (
  file: string,
  app: ResolvedConfig,
  load: () => Promise<typeof import("./film.ts")>,
): Filmed["scene"] => {
  const known = films.get(file);

  if (known) return known.scene;

  const { conditions = [], externalConditions = [] } = app.environments.ssr?.resolve ?? {};
  // `svjeez` and `@svjeez/dom` are external in the film's server: resolve them with the app's own conditions too.
  const custom = conditions.filter((condition) => !defaultServerConditions.includes(condition));

  const entry: Filmed = {
    scene: load()
      .catch((error: Error) => {
        throw new Error(
          `${file} imports @svjeez/dom/vite, so it is a film, but @svjeez/dom did not load (is it installed?): ${error.message}`,
          { cause: error },
        );
      })
      .then(({ runFilm }) =>
        runFilm(file, {
          config: {
            logLevel: app.logLevel,
            ssr: {
              resolve: {
                conditions,
                externalConditions: [...new Set([...externalConditions, ...custom])],
              },
            },
          },
        }),
      )
      .then((made) => ((entry.files = made.files), made)),
  };

  films.set(file, entry);
  entry.scene.catch(() => films.delete(file));

  return entry.scene;
};

const files = (node: EnvironmentModuleNode, found = new Set([node.file!])): Set<string> => {
  for (const imported of node.importedModules) {
    if (!imported.file || found.has(imported.file)) continue;
    found.add(imported.file);
    files(imported, found);
  }

  return found;
};

export const createRunner = (app: ResolvedConfig): Runner => {
  let environment: RunnableDevEnvironment | undefined;

  const ready = (async () => {
    const { conditions, externalConditions, noExternal, external } =
      app.environments.ssr?.resolve ?? {};

    const config = await resolveConfig(
      {
        configFile: false,
        // A scene with a <Shader> is written with TypeGPU, whose "use gpu" functions this environment compiles as it loads them.
        plugins: await typegpu(app.root),
        envDir: false,
        root: app.root,
        cacheDir: app.cacheDir,
        customLogger: app.logger,
        resolve: { alias: app.resolve.alias },
        oxc: { jsx: { runtime: "automatic", importSource: "svjeez" } },
        environments: {
          svjeez: {
            consumer: "server",
            resolve: {
              conditions,
              externalConditions,
              noExternal: noExternal === true ? undefined : noExternal,
              // The runtime's own `@svjeez/dom`, which the film file's server shares, not a copy compiled here (as a linked
              // workspace package would be): a scene made by one copy of `svjeez` can't be emitted by another.
              external:
                external === true ? true : [...(external ?? []), "@svjeez/dom", "@svjeez/dom/vite"],
            },
          },
        },
      },
      "serve",
    );

    environment = createRunnableDevEnvironment("svjeez", config, {
      hot: false,
      runnerOptions: { hmr: { logger: false } },
    });
    await environment.init();
    // <Shader> resolves its function with the app's typegpu, handed to the copy of svjeez the scenes run with.
    await environment.runner
      .import<typeof import("./typegpu.ts")>(TYPEGPU)
      .then(({ loadTypeGpu }) => loadTypeGpu(app.root, { transform: false }));

    return environment;
  })();

  return {
    async load(file, posters, inlinePrefix) {
      const { runner, moduleGraph } = await ready;

      if (FILM.test(await readFile(file, "utf8"))) {
        if (inlinePrefix !== undefined)
          throw new Error(
            `${file} is a film, whose markup is made by a browser and can't take a prefix, so it can't be imported with ?svjeez&inline. Import it with ?svjeez.`,
          );

        const [{ getScene }, made] = await Promise.all([
          runner.import<typeof import("./scene.ts")>(SCENE),
          film(file, app, () => runner.import<typeof import("./film.ts")>(RUN_FILM)),
        ]);

        return { image: getScene(made.svg, { posters }), dependencies: [...made.files] };
      }

      const [{ getScene }, scene] = await Promise.all([
        runner.import<typeof import("./scene.ts")>(SCENE),
        runner.import<{ default: SceneSource; prefix?: string }>(file),
      ]);

      const [node] = moduleGraph.getModulesByFile(file) ?? [];

      return {
        image: getScene(scene.default, {
          posters,
          ...(inlinePrefix !== undefined && { prefix: scene.prefix ?? inlinePrefix }),
        }),
        dependencies: node ? [...files(node)] : [file],
      };
    },
    invalidate(file) {
      for (const [key, { files }] of films)
        if (key === file || files?.includes(file)) films.delete(key);

      if (!environment) return;
      const { moduleGraph, runner } = environment;

      for (const node of moduleGraph.getModulesByFile(file) ?? [])
        moduleGraph.invalidateModule(node);
      const stale = [...(runner.evaluatedModules.getModulesByFile(file) ?? [])];

      for (let node = stale.pop(); node; node = stale.pop()) {
        if (!node.evaluated) continue;
        runner.evaluatedModules.invalidateModule(node);

        for (const id of node.importers) {
          const importer = runner.evaluatedModules.getModuleById(id);

          if (importer) stale.push(importer);
        }
      }
    },
    close: async () => (await ready).close(),
  };
};
