import { transform } from "sucrase";
import { CompileError } from "./errors.ts";
import { programOf } from "./program.ts";
import type { Exported, Namespace, Program } from "./program.ts";
import { GUARD, LIBRARY } from "./runner.ts";
import type { Modules } from "./runner.ts";

type Require = (specifier: string) => Namespace;

/** A module's body once it is a function: it fills `exports` and asks `require` for what it imports. */
export type Body = (require: Require, exports: Namespace) => void;

/**
 * How a host turns code into a function. The one place a runner decides how much it trusts the engine: a `vm` script
 * in a server process, `new Function` in a browser worker.
 */
export interface Define {
  readonly name: string;
  readonly define: (code: string, path: string) => Body;
}

/** `new Function` and `vm` wrap the code in a header, so a stack frame's line is past the file's own. Measured, since engines differ. */
const headerLines = (define: Define["define"]): number => {
  try {
    define("throw new Error()", "/probe")(() => ({}), {});
  } catch (thrown) {
    const at = thrown instanceof Error ? /\/probe:(\d+):\d+/.exec(thrown.stack ?? "") : undefined;

    if (at) return Number(at[1]) - 1;
  }

  return 0;
};

/** A frame's file, with or without the leading `/`: workerd names modules `a.js`, a vm names them `/a.js`. */
const FRAME = /([^\s():]+):(\d+):(\d+)/g;

/** Where an error left a scene file: the first stack frame inside one of the modules. `offset` is the lines an engine adds above a file. */
export const failure = (
  at: string,
  { message, stack = "" }: Error,
  files: Modules["files"],
  offset: number,
): CompileError => {
  for (const [, found, line, col] of stack.matchAll(FRAME)) {
    const file = found?.startsWith("/") ? found : `/${found}`;

    if (file !== GUARD && Object.hasOwn(files, file))
      return new CompileError({
        file: file.slice(1),
        line: Math.max(Number(line) - offset, 1),
        col: Number(col),
        message,
      });
  }

  return new CompileError({ file: at.slice(1), line: 1, col: 1, message });
};

const namespaceOf = (library: Namespace): Namespace => ({ ...library, __esModule: true });

const isReset = (value: Exported): value is () => void => typeof value === "function";

export interface Instance {
  /** The exports of `modules.entry`. */
  readonly entry: Namespace;
  /** The exports of every file. */
  readonly namespaces: readonly Namespace[];
  /** Restarts the loop guard. */
  readonly reset: () => void;
}

/**
 * Runs every module in this process: the ES modules become CommonJS (`sucrase`), each becomes a function through
 * `define`, and an import resolves to another module of `modules` or to one of `libraries`. Throws `CompileError`.
 */
export const instantiate = (
  modules: Modules,
  libraries: Readonly<Record<string, Namespace>>,
  { define }: Define,
): Instance => {
  const offset = headerLines(define);
  const loaded = new Map<string, Namespace>();

  const requireFrom = (path: string): Namespace => {
    const done = loaded.get(path);

    if (done) return done;
    const library = path.startsWith(LIBRARY) ? libraries[path.slice(LIBRARY.length)] : undefined;

    if (library) return namespaceOf(library);
    const source = modules.files[path];

    if (source === undefined) throw new Error(`Cannot find module "${path}".`);
    const exports: { [name: string]: Exported } = {};

    // A module is registered before it runs, so two files that import each other see one another's exports so far.
    loaded.set(path, exports);

    try {
      const code = transform(source, { transforms: ["imports"] }).code;

      define(code, path)(requireFrom, exports);
    } catch (thrown) {
      loaded.delete(path);
      throw thrown instanceof CompileError
        ? thrown
        : failure(path, asError(thrown), modules.files, offset);
    }

    return exports;
  };

  for (const path of Object.keys(modules.files)) requireFrom(path);
  const guard = loaded.get(GUARD);

  return {
    entry: requireFrom(modules.entry),
    namespaces: [...loaded.values()],
    reset: () => {
      const reset = guard?.["reset"];

      if (isReset(reset)) reset();
    },
  };
};

/** The program the modules make, run in this process. Throws `CompileError`. */
export const load = (
  modules: Modules,
  libraries: Readonly<Record<string, Namespace>>,
  engine: Define,
  ids: boolean,
): Program => {
  const { entry, namespaces, reset } = instantiate(modules, libraries, engine);

  return programOf(entry, namespaces, { ids, reset });
};

/** Whatever a scene throws: it may throw a string, a number or nothing. */
export type Thrown = {} | null | undefined;

/** What was thrown, as an `Error`. */
export const asError = (thrown: Thrown): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

/** Anything a runner throws while it loads, as the compile error it is: at the entry unless it says where. */
export const compileFailure =
  (modules: Modules) =>
  (thrown: Error | CompileError): CompileError =>
    thrown instanceof CompileError
      ? thrown
      : new CompileError({
          file: modules.entry.slice(1),
          line: 1,
          col: 1,
          message: thrown.message,
        });
