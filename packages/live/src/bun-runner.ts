import vm from "node:vm";
import { Effect, Layer } from "effect";
import { asError, compileFailure, load } from "./commonjs.ts";
import type { Body, Define } from "./commonjs.ts";
import type { Namespace } from "./program.ts";
import { Runner } from "./runner.ts";
import type { Modules } from "./runner.ts";

const engine: Define = {
  name: "vm",
  define: (code, path) => {
    // SAFETY: the function is compiled with those two parameters.
    return vm.compileFunction(code, ["require", "exports"], { filename: path }) as Body;
  },
};

const importLibraries = async (modules: Modules): Promise<Readonly<Record<string, Namespace>>> =>
  Object.fromEntries(
    await Promise.all(modules.libraries.map(async (name) => [name, await import(name)] as const)),
  );

/**
 * Runs scenes in this process, for tests and a CLI. The files run in this process's realm with its globals: the
 * compiler's checks are all that stands between a scene and the host, so use it for source you wrote or already trust.
 * Libraries resolve through `import()`, so whatever the process can import, a scene the allowlist let through can too.
 */
export const BunRunner: Layer.Layer<Runner> = Layer.succeed(Runner, {
  run: (modules, { ids = true } = {}) =>
    Effect.tryPromise({
      try: async () => load(modules, await importLibraries(modules), engine, ids),
      catch: (thrown) => compileFailure(modules)(asError(thrown)),
    }),
});
