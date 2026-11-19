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
  load(
    file: string,
    posters: boolean | PosterOptions,
  ): Promise<{ image: SceneImage; dependencies: string[] }>;
  invalidate(file: string): void;
  close(): Promise<void>;
}

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
            resolve: {
              conditions,
              externalConditions,
              noExternal: noExternal === true ? undefined : noExternal,
              external,
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
