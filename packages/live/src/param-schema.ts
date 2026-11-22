import type { Fields, Param, ScalarParam, Schema } from "svjeez/tools";
import type { JsonObject, JsonSchema } from "./types.ts";

/** Plain data out of anything JSON-shaped, as a library hands it over: what a facade or another language receives. */
export const toJson = <Value extends {}>(value: Value): JsonObject =>
  JSON.parse(JSON.stringify(value));

const scalar = (p: ScalarParam) => {
  const common = { ...(p.label !== undefined && { title: p.label }), default: p.value };

  switch (p.kind) {
    case "number":
      return { type: "number", minimum: p.min, maximum: p.max, ...common };
    case "color":
      return { type: "string", format: "color", ...common };
    case "easing":
      return { type: "object", ...common };
    case "choice":
      return { type: "string", enum: p.options, ...common };
    case "text":
      return {
        type: "string",
        ...(p.maxLength !== undefined && { maxLength: p.maxLength }),
        ...common,
      };
  }
};

const isScalar = (item: ScalarParam | Fields): item is ScalarParam => "kind" in item;

const fieldsOf = (fields: Fields) => ({
  type: "object",
  properties: Object.fromEntries(Object.entries(fields).map(([key, p]) => [key, scalar(p)])),
  additionalProperties: false,
});

const one = (p: Param) =>
  p.kind === "list"
    ? {
        type: "array",
        items: isScalar(p.item) ? scalar(p.item) : fieldsOf(p.item),
        minItems: p.min,
        ...(p.max !== undefined && { maxItems: p.max }),
        ...(p.label !== undefined && { title: p.label }),
        default: p.value,
      }
    : scalar(p);

/** A scene's `param.*` declarations as JSON Schema: every param optional, with its value as the default. */
export const schemaOf = (schema: Schema): JsonSchema =>
  toJson({
    type: "object",
    properties: Object.fromEntries(Object.entries(schema).map(([key, p]) => [key, one(p)])),
    additionalProperties: false,
  });

/** The params of a scene that declares none. */
export const NO_PARAMS: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
