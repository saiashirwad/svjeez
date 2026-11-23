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

const importLibraries = async (
  modules: Modules,
  given: Readonly<Record<string, Namespace>>,
): Promise<Readonly<Record<string, Namespace>>> =>
  Object.fromEntries(
    await Promise.all(
      modules.libraries.map(async (name) => [name, given[name] ?? (await import(name))] as const),
    ),
  );

/**
 * Runs scenes in this process, for tests and a CLI. The files run in this process's realm with its globals: the
 * compiler's checks are all that stands between a scene and the host, so use it for source you wrote or already trust.
 * A library resolves to the namespace in `libraries` when the host passes one, and through `import()` otherwise, so
 * whatever the process can import, a scene the allowlist let through can too.
 */
export const bunRunner = (
  libraries: Readonly<Record<string, Namespace>> = {},
): Layer.Layer<Runner> =>
  Layer.succeed(Runner, {
    run: (modules, { ids = true } = {}) =>
      Effect.tryPromise({
        try: async () => load(modules, await importLibraries(modules, libraries), engine, ids),
        catch: (thrown) => compileFailure(modules)(asError(thrown)),
      }),
  });

export const BunRunner: Layer.Layer<Runner> = bunRunner();
