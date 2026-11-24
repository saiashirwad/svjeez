import * as nodeModule from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { provideTypeGpu } from "./author/typegpu";

export interface LoadTypeGpuOptions {
  /**
   * Also make this runtime compile `"use gpu"` functions in the modules it imports next, with unplugin-typegpu's Bun
   * plugin or Node hook. Leave it off where a bundler's own plugin does that, as in `@svjeez/vite`. On by default.
   */
  readonly transform?: boolean;
  /**
   * The source files Bun's plugin compiles, as one regular expression on the path. It answers for every file it matches, and
   * Bun runs one plugin per file, so narrow it to the modules with `"use gpu"` when a later preload must see the rest.
   * Defaults to every source file outside `node_modules`.
   */
  readonly include?: RegExp;
}

/** What unplugin-typegpu exports for a build tool: a function that makes the plugin, from the options it takes. */
export type TypeGpuPlugin = (options?: { readonly include?: RegExp }) => object;

// Bun's plugin reads every file a regular expression lets through, and rewrites a CommonJS dependency as a module.
const SOURCE = /^(?!.*\/node_modules\/).*\.[cm]?[jt]sx?$/;

const isPlugin = (
  loaded: TypeGpuPlugin | { readonly default: TypeGpuPlugin },
): loaded is TypeGpuPlugin => typeof loaded === "function";

interface Runtime {
  readonly Symbol: SymbolConstructor;
  readonly Bun?: { plugin(plugin: ReturnType<TypeGpuPlugin>): void };
}

const runtime: Runtime = globalThis;

// The runtimes that were given the transform, so that a second load does not install it again.
const installed = new Set<string>();

/** The path of `name` as a project at `from` (a directory) would import it, or undefined when it is not installed. */
const found = (name: string, from: string): string | undefined => {
  try {
    return nodeModule.createRequire(join(from, "package.json")).resolve(name);
  } catch {
    return undefined;
  }
};

/** What unplugin-typegpu makes for `kind`, as the project at `from` has it installed; undefined without the package. */
export const typegpuPlugin = async (
  kind: "bun" | "node" | "vite",
  from: string,
): Promise<TypeGpuPlugin | undefined> => {
  const entry = found(`unplugin-typegpu/${kind}`, from);

  if (!entry) return undefined;

  const { default: loaded }: { default: TypeGpuPlugin | { default: TypeGpuPlugin } } = await import(
    /* @vite-ignore */ pathToFileURL(entry).href
  );

  // The path is the one `require` takes, which can be the package's CommonJS build: its function is then on `default`.
  return isPlugin(loaded) ? loaded : loaded.default;
};

const install = async (from: string, include: RegExp): Promise<void> => {
  const { Bun: bun } = runtime;
  const kind = bun ? "bun" : "node";

  // unplugin-typegpu's Node hook is `module.registerHooks`, which Node 20 does not have: its scenes with a "use gpu"
  // function can't be loaded there, and the rest still can.
  if (!bun && !("registerHooks" in nodeModule)) return;

  const make = await typegpuPlugin(kind, from);

  if (!make || installed.has(kind)) return;
  installed.add(kind);

  if (!bun) {
    make();

    return;
  }

  bun.plugin(make({ include }));
};

/**
 * Loads the TypeGPU that the project at `from` has installed and gives it to svjeez, so `<Shader>` can turn its
 * function into WGSL, once the scene's modules are loaded by a runtime that compiles `"use gpu"`. Does nothing, and
 * resolves false, in a project without typegpu: its scenes without a `<Shader>` need none.
 *
 * The transform is installed for modules imported after this call. Bun runs one plugin per file, the first that answers,
 * so a bunfig preload that handles every source file must come after one that loads TypeGPU.
 */
export const loadTypeGpu = async (
  from: string,
  { transform = true, include = SOURCE }: LoadTypeGpuOptions = {},
): Promise<boolean> => {
  const entry = found("typegpu", from);

  if (!entry) return false;

  if (transform) await install(from, include);
  provideTypeGpu(await import(/* @vite-ignore */ pathToFileURL(entry).href));

  return true;
};
