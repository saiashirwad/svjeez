import { transform } from "sucrase";
import * as svjeez from "svjeez";
import * as jsxDevRuntime from "svjeez/jsx-dev-runtime";
import * as jsxRuntime from "svjeez/jsx-runtime";
import * as geometry from "svjeez/geometry";
import * as params from "svjeez/params";
import * as sceneModel from "svjeez/scene";
import * as sceneJsxDevRuntime from "svjeez/scene/jsx-dev-runtime";
import * as sceneJsxRuntime from "svjeez/scene/jsx-runtime";
import type { Point } from "svjeez";
import type { Schema } from "svjeez/params";
import { fixFor } from "./fixes.ts";
import { gzipSize } from "./gzip.ts";
import type { Move } from "./probe.ts";

const modules = new Map<string, object>([
  ["svjeez", svjeez],
  ["svjeez/jsx-runtime", jsxRuntime],
  ["svjeez/jsx-dev-runtime", jsxDevRuntime],
  ["svjeez/geometry", geometry],
  ["svjeez/params", params],
  ["svjeez/scene", sceneModel],
  ["svjeez/scene/jsx-runtime", sceneJsxRuntime],
  ["svjeez/scene/jsx-dev-runtime", sceneJsxDevRuntime],
]);

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
  readonly fix?: string;
}

export interface SceneSize {
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  readonly title: string;
}

export interface Declared {
  readonly params?: Schema;
  readonly handles?: { readonly [key: string]: Move };
}

export type Compiled =
  | ({
      readonly ok: true;
      readonly svg: string;
      readonly stats: SceneStats;
      /** Read from the scene's own `render` call, so only a compile from source knows it. */
      readonly scene?: SceneSize;
      /**
       * A scene model's nodes at rest, placed in the scene, in paint order: each one's key, box and, from source,
       * the line that wrote it. `hitTest` from `svjeez/scene` finds the node under a point. Absent for an SVG string.
       */
      readonly nodes?: readonly sceneModel.Placed[];
      readonly ms: number;
    } & Declared)
  | { readonly ok: false; readonly error: SourceError; readonly ms: number };

const onNode = globalThis.process?.versions?.node !== undefined;

/** Node imports JSON only with `with { type: "json" }`, which Node 20 before 20.10 and Vite's dev server reject. */
const json = async (name: string, load: () => Promise<{ default: unknown }>) => ({
  __esModule: true,
  default: onNode
    ? (await import("node:module")).createRequire(import.meta.url)(name)
    : (await load()).default,
});

const packages = new Map<string, () => Promise<object>>([
  ["@svjeez/charts", () => import("@svjeez/charts")],
  ["@svjeez/code", () => import("@svjeez/code")],
  ["@svjeez/diagrams", () => import("@svjeez/diagrams")],
  ["@svjeez/geo", () => import("@svjeez/geo")],
  ["@svjeez/icons/lucide", () => import("@svjeez/icons/lucide")],
  ["@svjeez/icons/tabler", () => import("@svjeez/icons/tabler")],
  ["@svjeez/math", () => import("@svjeez/math")],
  ["@svjeez/mermaid", () => import("@svjeez/mermaid")],
  [
    "world-atlas/countries-110m.json",
    () => json("world-atlas/countries-110m.json", () => import("world-atlas/countries-110m.json")),
  ],
  [
    "world-atlas/land-110m.json",
    () => json("world-atlas/land-110m.json", () => import("world-atlas/land-110m.json")),
  ],
]);

const known = () => [...modules.keys(), ...packages.keys()].filter((name) => !name.includes("jsx"));

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

const isBuild = (value: unknown): value is () => string | sceneModel.Scene =>
  typeof value === "function";

const isText = (value: unknown): value is string => typeof value === "string";

const parseSyntax = (error: Error): SourceError => {
  const at = /^(.*) \((\d+):(\d+)\)$/s.exec(error.message);

  return at
    ? { kind: "syntax", message: at[1]!, line: Number(at[2]), column: Number(at[3]) + 1 }
    : { kind: "syntax", message: error.message };
};

// new Function adds two lines above the code, so stack frames are two lines past the editor's.
const HEADER_LINES = 2;

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

const handlesOf = (schema: Schema, handles: params.Handles<Schema>) => {
  const values = params.defaults(schema);
  const here: { readonly [key: string]: Point | undefined } = handles(values);

  return Object.fromEntries(
    Object.entries(schema).flatMap(([key, p]): [string, Move][] => {
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

/** The comments before a file's first statement, where a `@jsxImportSource` pragma goes. */
const LEADING = /^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*/;

/** Sucrase reads no pragma comments, so a file's `@jsxImportSource` is found here and handed to it. */
const importSourceOf = (source: string): string =>
  /@jsxImportSource\s+([^\s*]+)/.exec(LEADING.exec(source)?.[0] ?? "")?.[1] ?? "svjeez";

const sizeOf = (scene: sceneModel.Scene): SceneSize => ({
  width: scene.size[0],
  height: scene.size[1],
  duration: scene.duration,
  title: scene.title,
});

interface Built extends Declared {
  readonly svg: string;
  readonly scene?: SceneSize;
  readonly nodes?: readonly sceneModel.Placed[];
}

const SCENE_MODEL = "svjeez/scene";

/** A scene model's picture, its size and where each of its nodes is. */
const modelled = (made: sceneModel.Scene, sources: boolean): Built => ({
  svg: sceneModel.svg.emit(made, { sources }),
  scene: sizeOf(made),
  nodes: sceneModel.placements(made),
});

const run = async (source: string, sources: boolean): Promise<Built> => {
  const importSource = importSourceOf(source);

  // A scene model always records the line of each element: it only reaches the picture with `sources`, and the
  // nodes carry it for the editor.
  const { code } = transform(source, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "automatic",
    jsxImportSource: importSource,
    production: !sources && importSource !== SCENE_MODEL,
  });

  await load(code);
  let scene: SceneSize | undefined;

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

  const made: unknown = isBuild(exports.default) ? exports.default() : exports.default;

  const model = sceneModel.isScene(made) ? modelled(made, sources) : undefined;
  const svg: unknown = model ? model.svg : made;

  if (!isText(svg))
    throw new Error(
      isBuild(exports.default)
        ? "The default export should return a scene from scene(), or the string from render()."
        : "The scene needs a default export: export default scene({ ... }, () => ...), or a function that returns the string from render().",
    );
  const declared = isSchema(exports.params) ? exports.params : undefined;

  return {
    svg,
    ...(model ? { scene: model.scene, nodes: model.nodes } : scene && { scene }),
    ...(declared && { params: declared }),
    ...(declared &&
      isHandles(exports.handles) && { handles: handlesOf(declared, exports.handles) }),
  };
};

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
export const compileBuild = (build: () => string | sceneModel.Scene): Promise<Compiled> =>
  outcome(async () => {
    const made = build();

    return sceneModel.isScene(made) ? modelled(made, false) : { svg: made };
  });
