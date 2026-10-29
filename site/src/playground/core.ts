// Source text in, SVG and stats out. The worker runs it in the browser, tests/playground.test.ts runs it under bun.
import { transform } from "sucrase";
import * as svjeez from "svjeez";
import * as extras from "svjeez/extras";
import * as jsxRuntime from "svjeez/jsx-runtime";
import { fixFor } from "./fixes";

const modules = new Map<string, object>([
  ["svjeez", svjeez],
  ["svjeez/extras", extras],
  ["svjeez/jsx-runtime", jsxRuntime],
  ["svjeez/jsx-dev-runtime", jsxRuntime],
]);

// What a scene's module object holds once its code has run.
interface SceneModule {
  default?: unknown;
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

export type Compiled =
  | { readonly ok: true; readonly svg: string; readonly stats: SceneStats; readonly ms: number }
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
  ["world-atlas/countries-110m.json", () => json(import("world-atlas/countries-110m.json"))],
  ["world-atlas/land-110m.json", () => json(import("world-atlas/land-110m.json"))],
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
      `Cannot import "${name}". The playground has ${known()
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

const gzipSize = async (text: string): Promise<number> => {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));

  return (await new Response(stream).arrayBuffer()).byteLength;
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

/** The scene's default export, called. Throws what the author's code throws. */
const run = async (source: string): Promise<string> => {
  const { code } = transform(source, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "automatic",
    jsxImportSource: "svjeez",
    production: true,
  });

  await load(code);
  const exports: SceneModule = {};
  new Function("require", "exports", code)(requireModule, exports);

  if (!isBuild(exports.default))
    throw new Error(
      "The scene needs a default export: export default function build(): string { return render(...) }",
    );
  const svg: unknown = exports.default();

  if (!isText(svg)) throw new Error("build() should return the string from render().");

  return svg;
};

export const compileScene = async (source: string): Promise<Compiled> => {
  const start = performance.now();

  try {
    const svg = await run(source);
    const stats = await measure(svg);

    return { ok: true, svg, stats, ms: performance.now() - start };
  } catch (thrown) {
    const error = thrown instanceof Error ? thrown : new Error(String(thrown));

    return {
      ok: false,
      error:
        error.name === "SyntaxError" || /\(\d+:\d+\)$/.test(error.message)
          ? parseSyntax(error)
          : { kind: "runtime", message: error.message, ...placeOf(error), fix: fixFor(error.message) },
      ms: performance.now() - start,
    };
  }
};
