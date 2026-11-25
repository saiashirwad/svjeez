import { plugin, type PluginBuilder } from "bun";
import { fileURLToPath } from "node:url";

const LOADERS = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  mts: "ts",
  cts: "ts",
  mjs: "js",
  cjs: "js",
} as const;

const here = fileURLToPath(new URL(".", import.meta.url));

const skip = new RegExp(
  `^(?!${here.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|.*/node_modules/).*\\.[cm]?[jt]sx?$`,
);

const SVELTE = /^(?!.*\/node_modules\/).*\.svelte$/;

/** The code that makes a module record its own exports. The namespace is live: by the time `component()` reads it, every export is set. */
const register = (path: string): string =>
  `\nimport * as __svjeez_self from ${JSON.stringify(path)};\n(globalThis.svjeezDomRegistry ??= []).push({ file: ${JSON.stringify(path)}, exports: __svjeez_self });\n`;

type Load = Parameters<PluginBuilder["onLoad"]>[1];

/**
 * `bun-plugin-svelte`, if installed, registered for `.svelte.ts` modules and the like; its `.svelte` loader is handed back
 * so this preload can wrap it. Bun runs the first loader that answers, so only one of the two can own `.svelte`.
 */
const withSvelte = async (build: PluginBuilder): Promise<Load | undefined> => {
  const found = await import("bun-plugin-svelte").catch(() => undefined);

  if (!found) return;

  let loadSvelte: Load | undefined;

  // SAFETY: the plugin only calls `config`, `onLoad` and `onResolve` on its builder, and this forwards all three.
  const forward = {
    config: build.config,
    onLoad: (constraints, callback) => {
      if (constraints.filter.test("Component.svelte")) loadSvelte = callback;
      else build.onLoad(constraints, callback);

      return forward;
    },
    onResolve: (constraints, callback) => {
      build.onResolve(constraints, callback);

      return forward;
    },
  } as PluginBuilder;

  found.SveltePlugin({ development: true }).setup(forward);

  return loadSvelte;
};

/**
 * Preload this (`preload = ["@svjeez/dom/bun/preload"]` in bunfig.toml) so every module you load records its own exports.
 * `component()` then finds a component's module by identity: the file whose export `=== Card`.
 * With `bun-plugin-svelte` installed it also teaches the runtime to import `.svelte` files, and records them too.
 */
await plugin({
  name: "svjeez-dom-registry",
  async setup(build) {
    const loadSvelte = await withSvelte(build);

    if (loadSvelte)
      build.onLoad({ filter: SVELTE }, async (args) => {
        const loaded = await loadSvelte(args);

        // SAFETY: `bun-plugin-svelte` answers with `{ contents, loader }`.
        const { contents, loader } = loaded as { contents: string; loader: "ts" };

        return { loader, contents: contents + register(args.path) };
      });

    build.onLoad({ filter: skip }, async ({ path }) => {
      // SAFETY: the filter only lets the extensions in `LOADERS` through.
      const loader = LOADERS[path.slice(path.lastIndexOf(".") + 1) as keyof typeof LOADERS];
      const source = await Bun.file(path).text();

      return { loader, contents: source + register(path) };
    });
  },
});
