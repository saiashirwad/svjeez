import { Effect } from "effect";
import { transform } from "sucrase";
import { analyze, applied, placeOf } from "./analyze.ts";
import type { Change } from "./analyze.ts";
import { CompileError } from "./errors.ts";
import { GUARD, Runner, libraryPath } from "./runner.ts";
import type { Modules } from "./runner.ts";
import { guardImport, guardSource } from "./guard.ts";
import type { Program } from "./program.ts";
import type { Files } from "./types.ts";

/** Which packages a scene may import by name. A function, so a host can allow what it ships. */
export type Allowlist = (specifier: string) => boolean;

const SCENE_LIBRARIES: ReadonlySet<string> = new Set([
  "svjeez",
  "svjeez/jsx-runtime",
  "svjeez/jsx-dev-runtime",
]);

/** Packages of this repository that are not for scenes: they run a scene, build one into a page or drive a browser. */
const NOT_FOR_SCENES: ReadonlySet<string> = new Set([
  "@svjeez/live",
  "@svjeez/bin",
  "@svjeez/vite",
  "@svjeez/astro",
  "@svjeez/video",
  "@svjeez/og",
  "@svjeez/dom",
]);

/** `svjeez` and the add-ons that draw: `@svjeez/charts`, `@svjeez/icons/lucide`, … */
export const defaultAllowlist: Allowlist = (specifier) =>
  SCENE_LIBRARIES.has(specifier) ||
  (specifier.startsWith("@svjeez/") &&
    !NOT_FOR_SCENES.has(specifier.split("/").slice(0, 2).join("/")));

export interface CompileOptions {
  /** The file the scene is rendered from: a key of `files`. */
  readonly entry: string;
  /** The packages a scene may import. Defaults to `svjeez` and the `@svjeez/*` add-ons that draw. */
  readonly modules?: Allowlist;
  /** Iterations all loops of a scene may run, per render, before one fails. Defaults to 5 million. */
  readonly maxLoopIterations?: number;
  /** Emit `data-svz-id` on every element with an id, for a host that finds and edits them. On by default. */
  readonly ids?: boolean;
}

const CODE = /\.(?:tsx?|jsx?|mjs)$/;

const EXTENSIONS = [
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  "/index.tsx",
  "/index.ts",
  "/index.jsx",
  "/index.js",
];

const MAX_LOOP_ITERATIONS = 5_000_000;

/** A file name as the canonical path of a module: one leading `/`, no `./`. */
const canonical = (name: string): string => `/${name.replace(/^(?:\.?\/)+/, "")}`;

/** `./a/../b` from `/x` as `/x/b`, or undefined when it climbs out of the root. */
const joined = (from: string, relative: string): string | undefined => {
  const parts = from.split("/").slice(0, -1);

  for (const part of relative.split("/")) {
    if (part === "..") {
      if (parts.length <= 1) return undefined;
      parts.pop();
    } else if (part !== "." && part !== "") parts.push(part);
  }

  return parts.join("/");
};

const isRelative = (name: string): boolean => name.startsWith("./") || name.startsWith("../");

interface Compiling {
  readonly files: Readonly<Record<string, string>>;
  readonly allowed: Allowlist;
}

const SYNTAX = /^(.*) \((\d+):(\d+)\)$/s;

/** Sucrase says where a file stopped parsing as `message (line:column)`, the column counted from 0. */
const syntaxError = (file: string, error: Error): CompileError => {
  const at = SYNTAX.exec(error.message);

  return new CompileError({
    file,
    line: at ? Number(at[2]) : 1,
    col: at ? Number(at[3]) + 1 : 1,
    message: at?.[1] ?? error.message,
  });
};

const transpiled = (file: string, source: string): string => {
  try {
    return transform(source, {
      transforms: ["typescript", "jsx"],
      jsxRuntime: "automatic",
      jsxImportSource: libraryPath("svjeez"),
      filePath: file,
    }).code;
  } catch (thrown) {
    throw syntaxError(file, thrown instanceof Error ? thrown : new Error(String(thrown)));
  }
};

interface Built {
  readonly code: string;
  readonly libraries: readonly string[];
}

/** One scene file as an ES module that names its imports by canonical path. Throws `CompileError`. */
const build = (context: Compiling, file: string, source: string): Built => {
  // Syntax comes first: the checks below read a tree that is only right for a file that parses.
  transpiled(file, source);
  const found = analyze(source);
  const at = (offset: number) => ({ file, ...placeOf(source, offset) });

  const escape = found.escapes[0];

  if (escape)
    throw new CompileError({
      ...at(escape.at),
      message: escape.message,
    });
  const libraries: string[] = [];

  const rewrites = found.imports.map((use): Change => {
    if (isRelative(use.name)) {
      const base = joined(canonical(file), use.name);

      const target =
        base === undefined
          ? undefined
          : [base, ...EXTENSIONS.map((e) => base + e)].find((p) => Object.hasOwn(context.files, p));

      if (target === undefined)
        throw new CompileError({
          ...at(use.from),
          message: `Cannot find "${use.name}" among the files.`,
        });

      if (!CODE.test(target))
        throw new CompileError({
          ...at(use.from),
          message: `"${use.name}" is not code. A scene can import .ts, .tsx, .js, .jsx and .mjs files.`,
        });

      return { from: use.from, to: use.to, text: JSON.stringify(target) };
    }

    if (!context.allowed(use.name))
      throw new CompileError({
        ...at(use.from),
        message: `"${use.name}" is not available to scenes. A scene can import svjeez, the @svjeez add-ons and its own files.`,
      });
    libraries.push(use.name);

    return { from: use.from, to: use.to, text: JSON.stringify(libraryPath(use.name)) };
  });

  const code = transpiled(file, applied(source, [...rewrites, ...found.guards]));

  return {
    // The guard's import goes first, on the file's first line: a loop may run before an import further down would.
    code: found.guards.length > 0 ? `${guardImport} ${code}` : code,
    libraries: [...libraries, "svjeez/jsx-dev-runtime"],
  };
};

/**
 * Turns scene files into modules for a runner: TypeScript and JSX become JavaScript, every import is checked against
 * the allowlist and named by canonical path, the names that escape a scene are refused, and every loop counts its
 * iterations. Throws `CompileError`.
 */
const modulesOf = (files: Files, options: CompileOptions): Modules => {
  const names = Object.fromEntries(
    Object.entries(files).map(([name, source]) => [canonical(name), source]),
  );

  const entry = canonical(options.entry);
  const limit = options.maxLoopIterations ?? MAX_LOOP_ITERATIONS;

  const context: Compiling = {
    files: names,
    allowed: options.modules ?? defaultAllowlist,
  };

  if (!Object.hasOwn(names, entry))
    throw new CompileError({
      file: options.entry,
      line: 1,
      col: 1,
      message: `The entry "${options.entry}" is not among the files: ${Object.keys(files).join(", ") || "there are none"}.`,
    });

  const built = Object.entries(names)
    .filter(([path]) => CODE.test(path))
    .map(([path, source]) => [path, build(context, path.slice(1), source)] as const);

  return {
    entry,
    files: {
      ...Object.fromEntries(built.map(([path, { code }]) => [path, code])),
      [GUARD]: guardSource(limit),
    },
    libraries: [...new Set(built.flatMap(([, { libraries }]) => libraries))],
  };
};

/**
 * Compiles scene files to a program. Nothing runs here: the `Runner` in the environment decides where the code does,
 * so the same call works in a test, a browser worker or a Cloudflare isolate.
 */
export const compile = (
  files: Files,
  options: CompileOptions,
): Effect.Effect<Program, CompileError, Runner> =>
  Effect.gen(function* () {
    const modules = yield* Effect.try({
      try: () => modulesOf(files, options),
      catch: (thrown) =>
        thrown instanceof CompileError
          ? thrown
          : new CompileError({
              file: options.entry,
              line: 1,
              col: 1,
              message: thrown instanceof Error ? thrown.message : String(thrown),
            }),
    });

    const runner = yield* Runner;

    return yield* runner.run(modules, { ids: options.ids ?? true });
  });
