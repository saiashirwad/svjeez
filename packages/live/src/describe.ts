import { elementOf } from "./source.ts";
import type { Program } from "./program.ts";
import type {
  Attribute,
  Description,
  Element,
  Json,
  JsonObject,
  JsonSchema,
  Node,
  Parsed,
  Prop,
  UiHint,
} from "./types.ts";

const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isUi = (value: Json | undefined): value is JsonObject & UiHint =>
  isObject(value) && (value["control"] === undefined || typeof value["control"] === "string");

/** A JSON Schema for a value the component declares nothing about, read from how the literal is written. */
const inferred = (attribute: Attribute & { readonly kind: "literal" }): JsonSchema => {
  const { lit, value } = attribute;

  switch (lit) {
    case "string":
      return { type: "string" };
    case "color":
      return { type: "string", format: "color" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "null":
      return { type: "null" };
    case "ease":
    case "json":
      return Array.isArray(value) ? { type: "array" } : isObject(value) ? { type: "object" } : {};
  }
};

/** What the component's JSON Schema says about one prop, if it says anything. */
const declared = (program: Program, element: Element, name: string): JsonSchema | undefined => {
  const { components } = program;

  const entry = Object.hasOwn(components, element.component)
    ? components[element.component]
    : undefined;

  const properties = entry?.jsonSchema?.["properties"];

  if (!isObject(properties) || !Object.hasOwn(properties, name)) return undefined;
  const property = properties[name];

  return isObject(property) ? property : undefined;
};

const propOf = (program: Program, element: Element, attribute: Attribute): Prop => {
  if (attribute.kind !== "literal")
    return {
      editable: false,
      reason: attribute.kind,
      text: attribute.text,
      range: attribute.range,
      ...(attribute.param !== undefined && { param: attribute.param }),
    };

  const schema = declared(program, element, attribute.name);
  const ui = schema?.["x-ui"];

  return {
    editable: true,
    value: attribute.value,
    schema: schema ?? inferred(attribute),
    ...(isUi(ui) && { ui }),
    range: attribute.range,
  };
};

const nodeOf = (program: Program, element: Element): Node => ({
  id: element.id,
  component: element.component,
  range: element.range,
  props: Object.fromEntries(
    element.attributes
      .filter((attribute) => attribute.name !== "id")
      .map((attribute) => [attribute.name, propOf(program, element, attribute)]),
  ),
  children: element.children,
});

/**
 * What a host needs to build a form: every addressable element with its props, each marked editable (a literal, with
 * its schema and UI hint) or read-only (a param, an expression, a spread), plus the scene's params.
 */
export const describe = (parsed: Parsed, program: Program): Description => {
  const elements = parsed.order.flatMap((id) => elementOf(parsed, id) ?? []);

  return {
    // The scene's own root, not the root of a component's definition, which sits earlier in a file that defines one.
    root:
      (
        elements.find((element) => element.parent === undefined && element.scope === "") ??
        elements.find((element) => element.parent === undefined)
      )?.id ??
      parsed.order[0] ??
      "",
    nodes: Object.fromEntries(elements.map((element) => [element.id, nodeOf(program, element)])),
    params: program.params,
  };
};
