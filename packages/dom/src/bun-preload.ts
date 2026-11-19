import { plugin } from "bun";
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

// Source files only: not dependencies, and not this package.
const skip = new RegExp(
  `^(?!${here.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|.*/node_modules/).*\\.[cm]?[jt]sx?$`,
);

/**
 * Preload this (`preload = ["@svjeez/dom/bun/preload"]` in bunfig.toml) so every module you load records its own exports.
 * `component()` then finds a component's module by identity: the file whose export `=== Card`.
 */
plugin({
  name: "svjeez-dom-registry",
  setup(build) {
    build.onLoad({ filter: skip }, async ({ path }) => {
      // SAFETY: the filter only lets the extensions in `LOADERS` through.
      const loader = LOADERS[path.slice(path.lastIndexOf(".") + 1) as keyof typeof LOADERS];
      const source = await Bun.file(path).text();

      return {
        loader,
        // The namespace is live: by the time `component()` reads it, every export is set.
        contents: `${source}\nimport * as __svjeez_self from ${JSON.stringify(path)};\n(globalThis.svjeezDomRegistry ??= []).push({ file: ${JSON.stringify(path)}, exports: __svjeez_self });\n`,
      };
    });
  },
});
