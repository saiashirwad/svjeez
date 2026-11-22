import { Context } from "effect";
import type { Effect } from "effect";
import type { CompileError } from "./errors.ts";
import type { Program } from "./program.ts";

/**
 * Compiled JavaScript modules, ready for a runner. Every key is a canonical path: a scene file is its own path under a
 * `/` (`/groups/card.tsx`), and a library is `/@lib/<specifier>`. Every import in `files` names a module by one of
 * those paths, never by a relative one, so a runner that resolves names against the importer (as `workerd` does) finds
 * the same module from any folder.
 */
export interface Modules {
  readonly entry: string;
  /** ES module source by canonical path. Includes the loop guard, see `GUARD`. */
  readonly files: Readonly<Record<string, string>>;
  /** The libraries the files import, as the specifiers a scene writes: `svjeez`, `@svjeez/charts`. */
  readonly libraries: readonly string[];
}

export interface RunOptions {
  /** Emit `data-svz-id` on every element that has an id. On by default. */
  readonly ids?: boolean;
}

/** Where a library lives among the files of `Modules`. */
export const LIBRARY = "/@lib/";

export const libraryPath = (specifier: string): string => `${LIBRARY}${specifier}`;

/** The loop guard: `tick()` counts a loop iteration, `reset()` starts a new count. A runner resets it before each render. */
export const GUARD = "/@guard.js";

/** The module the loop guard, the host and the entry are generated into. A scene file may not take their paths. */
export const HOST = "/@host.js";
export const ENTRY = "/@entry.js";

/** Whether a canonical path is one a runner generates, which no scene file may take. */
export const isGenerated = (path: string): boolean =>
  path === GUARD || path === HOST || path === ENTRY || path.startsWith(LIBRARY);

/**
 * Where compiled modules run. The compiler turns scene files into `Modules`; a runner loads them wherever it can do so
 * safely (this process, a browser worker, a Cloudflare isolate) and answers with the `Program` they make.
 */
export class Runner extends Context.Service<
  Runner,
  {
    readonly run: (modules: Modules, options?: RunOptions) => Effect.Effect<Program, CompileError>;
  }
>()("@svjeez/live/Runner") {}
