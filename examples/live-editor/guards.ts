import type { Json, JsonObject } from "@svjeez/live";

export const isString = (value: Json | undefined): value is string => typeof value === "string";

export const isNumber = (value: Json | undefined): value is number => typeof value === "number";

export const isBoolean = (value: Json | undefined): value is boolean => typeof value === "boolean";

export const isArray = (value: Json | undefined): value is readonly Json[] => Array.isArray(value);

export const isObject = (value: Json | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The strings of a JSON Schema `enum`, or none. */
export const optionsOf = (schema: JsonObject): readonly string[] => {
  const options = schema["enum"];

  return isArray(options) ? options.filter(isString) : [];
};
