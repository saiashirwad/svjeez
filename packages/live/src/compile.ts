// Scene source text in, SVG and stats out, in the browser or under bun. A page runs it in a worker, so a scene that
// never returns costs the worker, not the page.
import { transform } from "sucrase";
import * as svjeez from "svjeez";
import * as extras from "svjeez/extras";
import * as jsxDevRuntime from "svjeez/jsx-dev-runtime";
import * as jsxRuntime from "svjeez/jsx-runtime";
import * as params from "svjeez/params";
import type { Point } from "svjeez";
import type { Schema } from "svjeez/params";
import { fixFor } from "./fixes.ts";
import { gzipSize } from "./gzip.ts";

const modules = new Map<string, object>([
  ["svjeez", svjeez],
  ["svjeez/extras", extras],
  ["svjeez/jsx-runtime", jsxRuntime],
  ["svjeez/jsx-dev-runtime", jsxDevRuntime],
  ["svjeez/params", params],
]);

// What a scene's module object holds once its code has run.
interface SceneModule {
  default?: unknown;
  params?: unknown;
  handles?: unknown;
}

export interface SceneStats {
  readonly bytes: number;
  readonly gzip: number;
  readonly keyframes: number;
  readonly scriptBytes: number;
}

export interface SourceError {
  /** Whether the source failed to parse, or parsed and then threw while it built the scene. */
  readonly kind: "syntax" | "runtime";
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  /** The scene-writing skill's fix for this message, with `code` in backticks. */
  readonly fix?: string;
}

/** What the scene passed to `render`: its size, how long one loop lasts, and its title. */
export interface SceneSize {
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  readonly title: string;
}

/** Where a number param's handle sits, and which way and how fast it moves per unit of the value, in scene units. */
export interface Handle {
  readonly at: Point;
  readonly way: Point;
}

/** What a scene declares beyond its picture: its params and where their handles sit, when it exports them. */
export interface Declared {
  readonly params?: Schema;
  readonly handles?: { readonly [key: string]: Handle };
}

export type Compiled =
  | ({
      readonly ok: true;
      readonly svg: string;
      readonly stats: SceneStats;
      /** Read from the scene's own `render` call, so only a compile from source knows it. */
      readonly scene?: SceneSize;
      readonly ms: number;
    } & Declared)
  | { readonly ok: false; readonly error: SourceError; readonly ms: number };

/** A JSON file as a default export that sucrase's import interop keeps as is. */
const json = async (file: Promise<{ default: unknown }>) => ({
  __esModule: true,
  default: (await file).default,
});

// The @svjeez packages and the map data load only when a scene imports them, so the worker starts small.
const packages = new Map<string, () => Promise<object>>([
  ["@svjeez/charts", () => import("@svjeez/charts")],
  ["@svjeez/code", () => import("@svjeez/code")],
  ["@svjeez/geo", () => import("@svjeez/geo")],
  ["@svjeez/icons/lucide", () => import("@svjeez/icons/lucide")],
  ["@svjeez/icons/tabler", () => import("@svjeez/icons/tabler")],
  ["@svjeez/math", () => import("@svjeez/math")],
  ["@svjeez/mermaid", () => import("@svjeez/mermaid")],
  [
    "world-atlas/countries-110m.json",
    () => json(import("world-atlas/countries-110m.json", { with: { type: "json" } })),
  ],
  [
    "world-atlas/land-110m.json",
    () => json(import("world-atlas/land-110m.json", { with: { type: "json" } })),
  ],
]);

const known = () => [...modules.keys(), ...packages.keys()].filter((name) => !name.includes("jsx"));

/** Loads every package the compiled code requires that isn't loaded yet. */
const load = async (code: string) => {
  const names = [...code.matchAll(/require\((["'])(.+?)\1\)/g)].map((match) => match[2]!);

  await Promise.all(
    names.map(async (name) => {
      const loader = packages.get(name);

      if (!modules.has(name) && loader) modules.set(name, await loader());
    }),
  );
};

const requireModule = (name: string): object => {
  const found = modules.get(name);

  if (!found)
    throw new Error(
      `Cannot import "${name}". Scenes here can import ${known()
        .map((n) => `"${n}"`)
        .join(", ")}.`,
    );

  return found;
};

const isBuild = (value: unknown): value is () => string => typeof value === "function";
const isText = (value: unknown): value is string => typeof value === "string";

/** Sucrase reports syntax errors as `message (line:column)`. */
const parseSyntax = (error: Error): SourceError => {
  const at = /^(.*) \((\d+):(\d+)\)$/s.exec(error.message);

  return at
    ? { kind: "syntax", message: at[1]!, line: Number(at[2]), column: Number(at[3]) + 1 }
    : { kind: "syntax", message: error.message };
};

// new Function puts two lines of its own above the code, and sucrase keeps the author's line numbers, so the first frame
// of the scene's own code on the stack is two lines past the line in the editor.
const HEADER_LINES = 2;

/** Where in the author's code a runtime error was thrown, read from V8's stack, when the stack says. */
const placeOf = (error: Error): { line?: number; column?: number } => {
  const at = /<anonymous>:(\d+):(\d+)/.exec(error.stack ?? "");
  const line = at ? Number(at[1]) - HEADER_LINES : 0;

  return line > 0 ? { line, column: Number(at![2]) } : {};
};

const measure = async (svg: string): Promise<SceneStats> => ({
  bytes: new TextEncoder().encode(svg).length,
  gzip: await gzipSize(svg),
  keyframes: (svg.match(/@keyframes\s/g) ?? []).length,
  scriptBytes: [...svg.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].reduce(
    (sum, match) => sum + match[1]!.length,
    0,
  ),
});

const isSchema = (value: unknown): value is Schema =>
  value instanceof Object && Object.values(value).every((p) => p instanceof Object && "kind" in p);

const isHandles = (value: unknown): value is params.Handles<Schema> => typeof value === "function";

/** Each number param's handle, and the way it moves, from the scene's `handles` at its values and a hair past each. */
const handlesOf = (schema: Schema, handles: params.Handles<Schema>) => {
  const values = params.defaults(schema);
  const here: { readonly [key: string]: Point | undefined } = handles(values);

  return Object.fromEntries(
    Object.entries(schema).flatMap(([key, p]): [string, Handle][] => {
      const at = here[key];

      if (p.kind !== "number" || !at) return [];
      const h = (p.max - p.min) / 10_000;

      const next: { readonly [key: string]: Point | undefined } = handles({
        ...values,
        [key]: p.value + h,
      });

      const to = next[key] ?? at;

      return [[key, { at, way: { x: (to.x - at.x) / h, y: (to.y - at.y) / h } }]];
    }),
  );
};

interface Built extends Declared {
  readonly svg: string;
  readonly scene?: SceneSize;
}

/** The scene's default export, called, with what it declares. Throws what the author's code throws. */
const run = async (source: string, sources: boolean): Promise<Built> => {
  const { code } = transform(source, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "automatic",
    jsxImportSource: "svjeez",
    production: !sources,
  });

  await load(code);
  let scene: SceneSize | undefined;

  // The scene's own render() call, read for its size and length, and with `sources` turned on when asked.
  const watched = {
    ...svjeez,
    render: (...[options, content]: Parameters<typeof svjeez.render>) => {
      scene ??= {
        width: options.width,
        height: options.height,
        duration: options.duration ?? 0,
        title: options.title ?? "",
      };

      return svjeez.render(sources ? { ...options, sources: true } : options, content);
    },
  };

  const exports: SceneModule = {};
  new Function("require", "exports", code)(
    (name: string) => (name === "svjeez" ? watched : requireModule(name)),
    exports,
  );

  if (!isBuild(exports.default))
    throw new Error(
      "The scene needs a default export: export default function build(): string { return render(...) }",
    );
  const svg: unknown = exports.default();

  if (!isText(svg)) throw new Error("build() should return the string from render().");
  const declared = isSchema(exports.params) ? exports.params : undefined;

  return {
    svg,
    ...(scene && { scene }),
    ...(declared && { params: declared }),
    ...(declared &&
      isHandles(exports.handles) && { handles: handlesOf(declared, exports.handles) }),
  };
};

/** Runs `make`, then measures the file it returns. Whatever it throws comes back as the error. */
const outcome = async (make: () => Promise<Built>): Promise<Compiled> => {
  const start = performance.now();

  try {
    const built = await make();
    const stats = await measure(built.svg);

    return { ok: true, ...built, stats, ms: performance.now() - start };
  } catch (thrown) {
    const error = thrown instanceof Error ? thrown : new Error(String(thrown));

    return {
      ok: false,
      error:
        error.name === "SyntaxError" || /\(\d+:\d+\)$/.test(error.message)
          ? parseSyntax(error)
          : {
              kind: "runtime",
              message: error.message,
              ...placeOf(error),
              fix: fixFor(error.message),
            },
      ms: performance.now() - start,
    };
  }
};

/** `sources` compiles the way `render({ sources: true })` does, so each element says which line of `source` made it. */
export const compileScene = (source: string, { sources = false } = {}): Promise<Compiled> =>
  outcome(() => run(source, sources));

/** For a page that ships its scene as code instead of source text: calls `build` and measures what it returns. */
export const compileBuild = (build: () => string): Promise<Compiled> =>
  outcome(async () => ({ svg: build() }));
