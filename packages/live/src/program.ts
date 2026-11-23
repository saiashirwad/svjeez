import { Effect } from "effect";
import {
  SceneError,
  componentMeta,
  isComponent,
  isScene,
  isStandardJsonSchema,
  parse,
  svg,
} from "svjeez/tools";
import type { StandardSchemaV1 } from "svjeez";
import type { Diagnostic, Scene, Schema } from "svjeez/tools";
import { RenderError } from "./errors.ts";
import { NO_PARAMS, schemaOf, toJson } from "./param-schema.ts";
import type { JsonObject, JsonSchema } from "./types.ts";

/** A component a scene file exports: its props as a Standard Schema, and as JSON Schema when the schema can write itself as one. */
export interface ComponentEntry {
  readonly props?: StandardSchemaV1;
  readonly jsonSchema?: JsonSchema;
}

/** What a render makes: the SVG, and what the SVG backend warns it cannot draw faithfully. */
export interface Rendered {
  readonly svg: string;
  readonly warnings: readonly Diagnostic[];
}

/** A compiled scene: draw it with params, and what it declares for a host to build a form from. */
export interface Program {
  readonly render: (params?: JsonObject) => Effect.Effect<Rendered, RenderError>;
  /** Every `component()` the scene files and the add-on libraries they import export, by `module#exportName`: `/groups/a/card.tsx#Card`, `wedding#Card`. */
  readonly components: Readonly<Record<string, ComponentEntry>>;
  /** The params the entry takes, as JSON Schema. */
  readonly params: JsonSchema;
}

/** Anything a module can export. */
export type Exported = {} | null | undefined;

/** A module's exports by name: whatever its author wrote, which a guard checks before the value is used. */
export interface Namespace {
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type
  readonly [name: string]: Exported;
}

type SceneFunction = (entered: Exported) => Exported;

type ComponentFunction = Parameters<typeof componentMeta>[0];

const isFunction = (value: Exported): value is SceneFunction => typeof value === "function";

const isRecord = (value: Exported): value is Namespace =>
  typeof value === "object" && value !== null;

const isStandard = (value: Exported): value is StandardSchemaV1 =>
  isRecord(value) && "~standard" in value;

const isParams = (value: Exported): value is Schema =>
  isRecord(value) &&
  !isScene(value) &&
  !isStandard(value) &&
  Object.values(value).every((p) => isRecord(p) && "kind" in p);

const isRegistered = (value: Exported): value is ComponentFunction =>
  // SAFETY: isComponent only looks the function up in a WeakMap, whatever it takes.
  typeof value === "function" && isComponent(value as ComponentFunction);

const TARGET = "draft-2020-12";

/** A Standard Schema as JSON Schema, when it can write itself as one. */
const jsonSchemaOf = (schema: StandardSchemaV1): JsonSchema | undefined => {
  if (!isStandardJsonSchema(schema)) return undefined;

  try {
    return toJson(schema["~standard"].jsonSchema.input({ target: TARGET }));
  } catch {
    return undefined;
  }
};

const componentsOf = (
  namespaces: Readonly<Record<string, Namespace>>,
): Readonly<Record<string, ComponentEntry>> =>
  Object.fromEntries(
    Object.entries(namespaces).flatMap(([module, namespace]) =>
      Object.entries(namespace)
        .filter((entry): entry is [string, ComponentFunction] => isRegistered(entry[1]))
        .map(([name, component]) => {
          const props = componentMeta(component)?.props;
          const jsonSchema = props && jsonSchemaOf(props);

          return [
            `${module}#${name}`,
            { ...(props && { props }), ...(jsonSchema && { jsonSchema }) },
          ] as const;
        }),
    ),
  );

const paramsOf = (declared: Exported): JsonSchema => {
  if (isParams(declared)) return schemaOf(declared);

  return (isStandard(declared) && jsonSchemaOf(declared)) || NO_PARAMS;
};

/** The values a scene function is called with: the params, checked against what the entry declares. */
const valuesOf = (declared: Exported, given: JsonObject): Exported => {
  if (isParams(declared)) return parse(declared, given);

  if (!isStandard(declared)) return given;
  const result = declared["~standard"].validate(given);

  if (result instanceof Promise)
    throw new SceneError(
      "The params schema validates asynchronously, but a scene is built in one step.",
      "Use a schema that validates synchronously.",
    );

  if (result.issues)
    throw new SceneError(
      `The params are rejected by their schema: ${result.issues.map((issue) => issue.message).join("; ")}.`,
    );

  return result.value;
};

const sceneOf = (entry: Namespace, given: JsonObject): Scene => {
  const made = isFunction(entry["default"])
    ? entry["default"](valuesOf(entry["params"], given))
    : entry["default"];

  if (isScene(made)) return made;

  throw new SceneError(
    "The entry needs a scene as its default export.",
    "Write `export default scene({ ... }, () => ...)`, or a function from params that returns one.",
  );
};

const renderError = (thrown: Error): RenderError =>
  new RenderError({
    message: thrown.message,
    ...(thrown instanceof SceneError && thrown.node !== undefined && { node: thrown.node }),
  });

export interface Hooks {
  readonly ids: boolean;
  /** Called before each render, to restart the loop guard. */
  readonly reset: () => void;
}

/** The program a loaded entry makes. `namespaces` are all the modules (by path) and add-on libraries (by specifier), so a component is found wherever it is exported. */
export const programOf = (
  entry: Namespace,
  namespaces: Readonly<Record<string, Namespace>>,
  { ids, reset }: Hooks,
): Program => ({
  render: (params = {}) =>
    Effect.try({
      try: () => {
        reset();

        const warnings: Diagnostic[] = [];

        const drawn = svg.emit(sceneOf(entry, params), {
          ids,
          onWarning: (warning) => warnings.push(warning),
        });

        return { svg: drawn, warnings };
      },
      catch: (thrown) => renderError(thrown instanceof Error ? thrown : new Error(String(thrown))),
    }),
  components: componentsOf(namespaces),
  params: paramsOf(entry["params"]),
});
