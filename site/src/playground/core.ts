// Source text in, SVG and stats out. The worker runs it in the browser, tests/playground.test.ts runs it under bun.
import { transform } from "sucrase";
import * as svjeez from "svjeez";
import * as extras from "svjeez/extras";
import * as jsxRuntime from "svjeez/jsx-runtime";

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
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
}

export type Compiled =
  | { readonly ok: true; readonly svg: string; readonly stats: SceneStats; readonly ms: number }
  | { readonly ok: false; readonly error: SourceError; readonly ms: number };

const requireModule = (name: string): object => {
  const found = modules.get(name);

  if (!found)
    throw new Error(`Cannot import "${name}". The playground has "svjeez" and "svjeez/extras".`);

  return found;
};

const isBuild = (value: unknown): value is () => string => typeof value === "function";
const isText = (value: unknown): value is string => typeof value === "string";

/** Sucrase reports syntax errors as `message (line:column)`. */
const parseSyntax = (error: Error): SourceError => {
  const at = /^(.*) \((\d+):(\d+)\)$/s.exec(error.message);

  return at
    ? { message: at[1]!, line: Number(at[2]), column: Number(at[3]) + 1 }
    : { message: error.message };
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
const run = (source: string): string => {
  const { code } = transform(source, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "automatic",
    jsxImportSource: "svjeez",
    production: true,
  });

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
    const svg = run(source);
    const stats = await measure(svg);

    return { ok: true, svg, stats, ms: performance.now() - start };
  } catch (thrown) {
    const error = thrown instanceof Error ? thrown : new Error(String(thrown));

    return {
      ok: false,
      error:
        error.name === "SyntaxError" || /\(\d+:\d+\)$/.test(error.message)
          ? parseSyntax(error)
          : { message: error.message },
      ms: performance.now() - start,
    };
  }
};
