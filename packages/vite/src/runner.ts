// Scenes run in a Vite environment of their own, apart from the app's. The app may compile .tsx as React, and a scene's
// JSX has to compile as svjeez. The environment resolves imports the way the app's server environment does, and
// getScene() runs inside it too, so the poster renderer uses the svjeez that the scene resolved.
import { fileURLToPath } from "node:url";
import {
  createRunnableDevEnvironment,
  resolveConfig,
  type EnvironmentModuleNode,
  type ResolvedConfig,
  type RunnableDevEnvironment,
} from "vite";
import type { PosterOptions } from "./posters.ts";
import type { SceneImage, SceneSource } from "./scene.ts";

export interface Runner {
  /** Runs a scene module and compiles it. `dependencies` are its file and the files it imports, directly or not. */
  load(
    file: string,
    posters: boolean | PosterOptions,
  ): Promise<{ image: SceneImage; dependencies: string[] }>;
  /** Forgets a changed file and every module that imports it, so the next load runs them again. */
  invalidate(file: string): void;
  close(): Promise<void>;
}

// Without an extension, so it resolves to scene.ts in this repository and to scene.js in the published package.
const SCENE = fileURLToPath(new URL("./scene", import.meta.url));

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
    // A client-only build has no server environment, and then the scene environment keeps Vite's defaults.
    const { conditions, externalConditions, noExternal, external } =
      app.environments.ssr?.resolve ?? {};

    const config = await resolveConfig(
      {
        configFile: false,
        envDir: false,
        root: app.root,
        cacheDir: app.cacheDir,
        customLogger: app.logger,
        resolve: { alias: app.resolve.alias },
        oxc: { jsx: { runtime: "automatic", importSource: "svjeez" } },
        environments: {
          svjeez: {
            consumer: "server",
            resolve: { conditions, externalConditions, noExternal, external },
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

    return environment;
  })();

  return {
    async load(file, posters) {
      const { runner, moduleGraph } = await ready;

      const [{ getScene }, scene] = await Promise.all([
        runner.import<typeof import("./scene.ts")>(SCENE),
        runner.import<{ default: SceneSource }>(file),
      ]);

      const [node] = moduleGraph.getModulesByFile(file) ?? [];

      return {
        image: getScene(scene.default, { posters }),
        dependencies: node ? [...files(node)] : [file],
      };
    },
    invalidate(file) {
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
