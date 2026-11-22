import { Effect, Layer } from "effect";
import * as svjeez from "svjeez";
import { asError, compileFailure, load } from "./commonjs.ts";
import type { Body, Define } from "./commonjs.ts";
import type { Namespace } from "./program.ts";
import { Runner } from "./runner.ts";

/** The only `new Function` in the package: a browser has no `vm`. A Web Worker keeps its result away from the page. */
const engine: Define = {
  name: "new Function",
  define: (code, path) => {
    // SAFETY: `new Function("require", "exports", code)` is a function of those two parameters.
    return new Function("require", "exports", `${code}\n//# sourceURL=${path}`) as Body;
  },
};

/** The JSX runtimes load on first use, as `bun-runner.ts` does, so importing this file does not pull them in. */
const core = async (): Promise<Readonly<Record<string, Namespace>>> => ({
  svjeez,
  "svjeez/jsx-runtime": await import("svjeez/jsx-runtime"),
  "svjeez/jsx-dev-runtime": await import("svjeez/jsx-dev-runtime"),
});

/**
 * Runs scenes where `new Function` is the only way to run text, a browser or a Web Worker. Libraries cannot be
 * imported by name there, so `svjeez` is bundled in and an add-on a scene may import is passed in `libraries`.
 *
 * This is a trusted, in-realm adapter, not a sandbox. The scene's code runs in the realm that calls it and shares its
 * globals, `window` and `document` included, and the compiler's checks only catch mistakes. Use it for code the user
 * wrote themselves, ideally inside a dedicated Web Worker. For code somebody else wrote, run it in a Worker you can
 * terminate, or through `WorkerLoaderRunner`, whose isolate has no network and no way to the host's globals.
 */
export const browserRunner = (
  libraries: Readonly<Record<string, Namespace>> = {},
): Layer.Layer<Runner> =>
  Layer.succeed(Runner, {
    run: (modules, { ids = true } = {}) =>
      Effect.tryPromise({
        try: async () => load(modules, { ...(await core()), ...libraries }, engine, ids),
        catch: (thrown) => compileFailure(modules)(asError(thrown)),
      }),
  });

export const BrowserRunner: Layer.Layer<Runner> = browserRunner();
