import { Effect, Layer } from "effect";
import type { StandardSchemaV1 } from "svjeez";
import type { Diagnostic, Schema } from "svjeez/tools";
import { asError, failure } from "./commonjs.ts";
import { CompileError, RenderError } from "./errors.ts";
import { schemaOf, NO_PARAMS } from "./param-schema.ts";
import type { Program, Rendered } from "./program.ts";
import { GUARD, HOST, Runner, isGenerated, libraryPath } from "./runner.ts";
import type { Modules } from "./runner.ts";
import type { JsonObject, JsonSchema } from "./types.ts";

/** What a Worker Loader needs to start an isolate: a subset of Cloudflare's `WorkerCode`, so a binding takes it as is. */
export interface WorkerCode {
  readonly compatibilityDate: string;
  readonly mainModule: string;
  readonly modules: Readonly<Record<string, { readonly js: string }>>;
  /** `null` cuts the isolate off from the network: it can neither fetch nor connect. */
  readonly globalOutbound: null;
  readonly limits?: { readonly cpuMs?: number };
  readonly compatibilityFlags?: readonly string[];
}

export interface WorkerEntrypoint {
  readonly fetch: (request: Request) => Promise<Response>;
}

/** The Worker Loader binding (`env.LOADER`): starts a worker from code, and finds it again by id. */
export interface WorkerLoader {
  readonly get: (
    id: string,
    code: () => WorkerCode | Promise<WorkerCode>,
  ) => { readonly getEntrypoint: () => WorkerEntrypoint };
}

export interface WorkerLoaderOptions {
  /**
   * ES module source for each library a scene imports, by the specifier a scene writes: `svjeez`,
   * `svjeez/jsx-dev-runtime`, `svjeez/tools` (the runner itself needs it) and every add-on. An isolate has nothing to
   * import from, so each one is a bundle. Bundles that share code must import one another as `/@lib/<specifier>`,
   * not inline it, or `svjeez/tools` would not see the components `svjeez` registered.
   * Every entry is shipped, so a shared chunk a bundle imports as `/@lib/<specifier>` belongs here under that specifier.
   */
  readonly libraries?: Readonly<Record<string, string>>;
  readonly compatibilityDate?: string;
  /** Extra compatibility flags. `disallow_eval_during_startup` is always sent, so a scene cannot compile code while it loads. */
  readonly compatibilityFlags?: readonly string[];
  /** CPU time a request may use. Left out, the binding's own limit applies. `workerd` run on its own ignores it. */
  readonly cpuMs?: number;
  /**
   * Names the pool of warm isolates this runner draws from. The loader reuses a worker, with whatever its modules hold in
   * memory, for every run that has the same code; runners with different scopes never share one. Give each session
   * (or tenant) its own scope when scene code could keep state between renders.
   */
  readonly scope?: string;
  /** Start a new isolate for every run, so no module state outlives it. Costs a cold start each time. */
  readonly fresh?: boolean;
}

const ORIGIN = "https://scene.invalid/";
const COMPATIBILITY_DATE = "2025-06-01";

/**
 * The worker's front door. `GET` says what the entry declares: its `params`, and each component's JSON Schema.
 * `POST` draws it. It does what `programOf` does in process, from inside the isolate.
 */
const hostSource = (modules: Modules, ids: boolean): string => {
  const others = Object.keys(modules.files).filter((p) => p !== modules.entry && p !== GUARD);
  const addons = modules.libraries.filter((name) => !name.startsWith("svjeez"));

  return `import { isScene, isComponent, componentMeta, isStandardJsonSchema, parse, svg, SceneError } from "${libraryPath("svjeez/tools")}";
import { reset } from "${GUARD}";
import * as entry from ${JSON.stringify(modules.entry)};
${others.map((path, i) => `import * as other${i} from ${JSON.stringify(path)};`).join("\n")}
${addons.map((name, i) => `import * as addon${i} from ${JSON.stringify(libraryPath(name))};`).join("\n")}
const namespaces = [entry, ${[...others.map((_, i) => `other${i}`), ...addons.map((_, i) => `addon${i}`)].join(", ")}];
const isObject = (v) => v !== null && typeof v === "object";
const isStandard = (v) => isObject(v) && "~standard" in v;
const isParams = (v) => isObject(v) && !isScene(v) && !isStandard(v) && Object.values(v).every((p) => isObject(p) && "kind" in p);
const jsonSchemaOf = (schema) => {
  try { return isStandardJsonSchema(schema) ? schema["~standard"].jsonSchema.input({ target: "draft-2020-12" }) : undefined; } catch { return undefined; }
};
const components = Object.fromEntries(namespaces.flatMap((ns) => Object.values(ns).filter((v) => typeof v === "function" && isComponent(v)).map((fn) => {
  const { name, props } = componentMeta(fn);
  return [name, props];
})));
const describe = () => ({
  params: isParams(entry.params) ? { declared: entry.params } : { json: isStandard(entry.params) ? jsonSchemaOf(entry.params) : undefined },
  components: Object.fromEntries(Object.entries(components).map(([name, props]) => [name, { jsonSchema: props ? jsonSchemaOf(props) : undefined, hasProps: Boolean(props) }])),
});
const valuesOf = (declared, given) => {
  if (isParams(declared)) return parse(declared, given);
  if (!isStandard(declared)) return given;
  const result = declared["~standard"].validate(given);
  if (result instanceof Promise) throw new SceneError("The params schema validates asynchronously, but a scene is built in one step.", "Use a schema that validates synchronously.");
  if (result.issues) throw new SceneError("The params are rejected by their schema: " + result.issues.map((i) => i.message).join("; ") + ".");
  return result.value;
};
const draw = (given) => {
  const made = typeof entry.default === "function" ? entry.default(valuesOf(entry.params, given)) : entry.default;
  if (!isScene(made)) throw new SceneError("The entry needs a scene as its default export.");
  const warnings = [];
  const drawn = svg.emit(made, { ids: ${ids}, onWarning: (warning) => warnings.push(warning) });
  return { svg: drawn, warnings };
};
export default {
  async fetch(request) {
    if (request.method === "GET") return Response.json(describe());
    try {
      reset();
      const body = await request.json();
      if (body.validate) {
        const props = components[body.validate.component];
        return Response.json(props ? await props["~standard"].validate(body.validate.props) : {});
      }
      const { params } = body;
      return Response.json(draw(params ?? {}));
    } catch (error) {
      return Response.json({ error: { message: error.message, node: error instanceof SceneError ? error.node : undefined } });
    }
  },
};
`;
};

/** The worker for `modules`: every file, every library and the front door, named without the leading `/`. */
const workerCode = (
  modules: Modules,
  ids: boolean,
  {
    libraries = {},
    compatibilityDate = COMPATIBILITY_DATE,
    compatibilityFlags = [],
    cpuMs,
  }: WorkerLoaderOptions,
): Effect.Effect<WorkerCode, CompileError> => {
  const wanted = [...new Set([...modules.libraries, "svjeez/tools", ...Object.keys(libraries)])];

  const reserved = Object.keys(modules.files).filter((path) => path !== GUARD && isGenerated(path));

  if (reserved.length > 0)
    return Effect.fail(
      new CompileError({
        file: reserved[0]?.slice(1) ?? "",
        line: 1,
        col: 1,
        message: `${reserved.map((path) => `"${path.slice(1)}"`).join(", ")} is a path the worker generates modules at. Rename the file.`,
      }),
    );

  const missing = wanted.filter((name) => libraries[name] === undefined);

  if (missing.length > 0)
    return Effect.fail(
      new CompileError({
        file: modules.entry.slice(1),
        line: 1,
        col: 1,
        message: `The Worker Loader has no bundle for ${missing.map((name) => `"${name}"`).join(", ")}. Pass each in WorkerLoaderRunner's libraries.`,
      }),
    );

  const sources = {
    ...modules.files,
    ...Object.fromEntries(wanted.map((name) => [libraryPath(name), libraries[name] ?? ""])),
    [HOST]: hostSource(modules, ids),
  };

  return Effect.succeed({
    compatibilityDate,
    compatibilityFlags: [...new Set(["disallow_eval_during_startup", ...compatibilityFlags])],
    mainModule: HOST.slice(1),
    modules: Object.fromEntries(
      Object.entries(sources).map(([path, js]) => [path.slice(1), { js }]),
    ),
    globalOutbound: null,
    ...(cpuMs !== undefined && { limits: { cpuMs } }),
  });
};

interface Described {
  readonly params: { readonly declared?: Schema; readonly json?: JsonSchema };
  readonly components: Readonly<
    Record<string, { readonly jsonSchema?: JsonSchema; readonly hasProps?: boolean }>
  >;
}

interface Reply {
  readonly svg?: string;
  readonly warnings?: readonly Diagnostic[];
  readonly error?: { readonly message: string; readonly node?: string };
}

const render = (
  worker: WorkerEntrypoint,
  params: JsonObject,
): Effect.Effect<Rendered, RenderError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await worker.fetch(
        new Request(ORIGIN, { method: "POST", body: JSON.stringify({ params }) }),
      );

      // SAFETY: the front door in `hostSource` answers every POST with this shape.
      const reply = (await response.json()) as Reply;

      if (reply.svg === undefined)
        throw new RenderError({
          message: reply.error?.message ?? "The worker drew nothing.",
          ...(reply.error?.node !== undefined && { node: reply.error.node }),
        });

      return { svg: reply.svg, warnings: reply.warnings ?? [] };
    },
    catch: (thrown) =>
      thrown instanceof RenderError
        ? thrown
        : new RenderError({ message: asError(thrown).message }),
  });

/** A props schema that asks the isolate to run the component's own `validate`, so the host needs no copy of it. */
const propsIn = (worker: WorkerEntrypoint, component: string): StandardSchemaV1 => ({
  "~standard": {
    version: 1,
    vendor: "svjeez-worker",
    validate: async (props) => {
      const response = await worker.fetch(
        new Request(ORIGIN, {
          method: "POST",
          body: JSON.stringify({ validate: { component, props } }),
        }),
      );

      // SAFETY: the front door in `hostSource` answers a validate with a Standard Schema result.
      return (await response.json()) as StandardSchemaV1.Result<unknown>;
    },
  },
});

const programOf = (worker: WorkerEntrypoint, described: Described): Program => ({
  render: (params = {}) => render(worker, params),
  components: Object.fromEntries(
    Object.entries(described.components).map(([name, { jsonSchema, hasProps }]) => [
      name,
      { ...(jsonSchema && { jsonSchema }), ...(hasProps && { props: propsIn(worker, name) }) },
    ]),
  ),
  params: described.params.declared
    ? schemaOf(described.params.declared)
    : (described.params.json ?? NO_PARAMS),
});

const hex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * What names the isolate: SHA-256 over everything the loader would start it from (its entry, every module's text, the
 * compatibility date and flags, limits, the network setting), the scope, and a nonce for a `fresh` run. The loader reuses a
 * worker by this id, so two different workers must never share one.
 */
const idOf = (code: WorkerCode, { scope, fresh }: WorkerLoaderOptions): Effect.Effect<string> =>
  Effect.promise(async () => {
    const modules = Object.entries(code.modules)
      .map(([path, { js }]) => [path, js] as const)
      .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    const text = JSON.stringify([
      code.compatibilityDate,
      code.compatibilityFlags ?? [],
      code.mainModule,
      modules,
      code.globalOutbound,
      code.limits?.cpuMs ?? null,
      scope ?? null,
      fresh ? crypto.randomUUID() : null,
    ]);

    return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  });

/**
 * Runs scenes in a Cloudflare isolate through the Worker Loader binding (`env.LOADER`). The isolate has no network
 * (`globalOutbound: null`) and no way to reach the host's globals or secrets, so it is the real boundary around code
 * somebody else wrote. The compiler's checks stop mistakes; this stops attacks.
 */
export const WorkerLoaderRunner = (
  loader: WorkerLoader,
  options: WorkerLoaderOptions = {},
): Layer.Layer<Runner> => {
  return Layer.succeed(Runner, {
    run: (modules, { ids = true } = {}) =>
      Effect.gen(function* () {
        const code = yield* workerCode(modules, ids, options);

        const worker = loader.get(yield* idOf(code, options), () => code).getEntrypoint();

        const described = yield* Effect.tryPromise({
          // SAFETY: the front door in `hostSource` answers every GET with this shape.
          try: async () => (await (await worker.fetch(new Request(ORIGIN))).json()) as Described,
          catch: (thrown) => failure(modules.entry, asError(thrown), modules.files, 0),
        });

        return programOf(worker, described);
      }),
  });
};
