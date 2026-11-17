import { hexOf, type Hex } from "./color";
import type { Point } from "./layout/box";
import { ease, type Ease } from "./motion";

interface Labelled {
  readonly label?: string;
}

export interface NumberParam extends Labelled {
  readonly kind: "number";
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Printed after the value, as in `s` for seconds. */
  readonly unit?: string;
  /** `log` gives every small value as much room on a slider as every large one. Needs a positive `min`. */
  readonly scale?: "linear" | "log";
}

export interface ColorParam extends Labelled {
  readonly kind: "color";
  readonly value: Hex;
}

export interface EasingParam extends Labelled {
  readonly kind: "easing";
  readonly value: Ease;
}

export interface ChoiceParam<T extends string = string> extends Labelled {
  readonly kind: "choice";
  readonly value: T;
  readonly options: readonly T[];
}

export interface TextParam extends Labelled {
  readonly kind: "text";
  readonly value: string;
  /** The most characters a value may have, so a template's layout can count on it. */
  readonly maxLength?: number;
}

export type ScalarParam = NumberParam | ColorParam | EasingParam | ChoiceParam | TextParam;

export type Fields = { readonly [key: string]: ScalarParam };

export type ItemValue<I extends ScalarParam | Fields> = I extends ScalarParam
  ? I["value"]
  : { readonly [K in keyof I]: I[K] extends ScalarParam ? I[K]["value"] : never };

export interface ListParam<I extends ScalarParam | Fields = ScalarParam | Fields> extends Labelled {
  readonly kind: "list";
  readonly item: I;
  readonly value: readonly ItemValue<I>[];
  /** The fewest items, 0 by default. */
  readonly min: number;
  readonly max?: number;
}

export type Param = ScalarParam | ListParam;

export type Schema = { readonly [key: string]: Param };

export type Values<S extends Schema> = { readonly [K in keyof S]: S[K]["value"] };

export type Range = Pick<NumberParam, "min" | "max">;

export type Extras = Partial<Pick<NumberParam, "step" | "unit" | "scale" | "label">>;

const check = (name: string, p: NumberParam): NumberParam => {
  const at = `${name}(${p.value})`;

  if (!(Number.isFinite(p.min) && Number.isFinite(p.max) && p.min < p.max))
    throw new Error(`${at} needs min below max, both finite, got ${p.min} and ${p.max}.`);

  if (!(p.step > 0 && Number.isFinite(p.step)))
    throw new Error(`${at} needs a positive finite step, got ${p.step}.`);

  if (!(Number.isFinite(p.value) && p.value >= p.min && p.value <= p.max))
    throw new Error(`${at} is outside its range ${p.min} to ${p.max}.`);

  if (p.scale === "log" && p.min <= 0)
    throw new Error(`${at} has a log scale, so its min must be positive, got ${p.min}.`);

  return p;
};

/** Any number in `[min, max]`, in steps of `step` (default 0.01). */
export const number = (value: number, options: Range & Extras): NumberParam =>
  check("number", { kind: "number", value, step: 0.01, ...options });

/** A whole number from `min` (default 0) to `max`. */
export const count = (
  value: number,
  options: Partial<Range> & Pick<Range, "max"> & Omit<Extras, "step">,
): NumberParam => {
  if (!Number.isInteger(value)) throw new Error(`count(${value}) needs a whole number.`);

  const { min = 0, max } = options;

  if (!(Number.isInteger(min) && Number.isInteger(max)))
    throw new Error(`count(${value}) needs whole-number bounds, got ${min} and ${max}.`);

  return check("count", { kind: "number", value, min: 0, ...options, step: 1 });
};

/** A time in seconds from `min` (default 0) to `max`, in steps of `step` (default 0.01). */
export const seconds = (
  value: number,
  options: Partial<Range> & Pick<Range, "max"> & Extras,
): NumberParam =>
  check("seconds", { kind: "number", value, min: 0, step: 0.01, unit: "s", ...options });

export const color = (value: Hex, options: Labelled = {}): ColorParam => ({
  kind: "color",
  value: hexOf(value, "color()"),
  ...options,
});

export const easing = (value: Ease, options: Labelled = {}): EasingParam => ({
  kind: "easing",
  value,
  ...options,
});

export const choice = <const T extends string>(
  value: NoInfer<T>,
  options: readonly T[],
  extras: Labelled = {},
): ChoiceParam<T> => {
  if (new Set(options).size !== options.length)
    throw new Error(
      `choice("${value}") needs distinct options, got ${options.map((o) => `"${o}"`).join(", ")}.`,
    );

  if (!options.includes(value))
    throw new Error(`choice("${value}") is not one of ${options.map((o) => `"${o}"`).join(", ")}.`);

  return { kind: "choice", value, options, ...extras };
};

/** A line of text, at most `maxLength` characters when given. */
export const text = (
  value: string,
  options: Labelled & Pick<TextParam, "maxLength"> = {},
): TextParam => {
  const { maxLength } = options;

  if (maxLength !== undefined && !(Number.isInteger(maxLength) && maxLength > 0))
    throw new Error(`text(${show(value)}) needs a whole maxLength of 1 or more, got ${maxLength}.`);

  valueOf({ kind: "text", value, maxLength }, value, "text()");

  return { kind: "text", value, ...options };
};

/**
 * A list of items, each a scalar or a record of scalars: `list(text(""), ["a", "b"])`, or
 * `list({ label: text("Q1"), value: number(4, { min: 0, max: 100 }) }, [{ label: "Q1", value: 4 }])`. A record's
 * field values are what a partial item from `parse` falls back to. `min` (default 0) and `max` bound the length.
 */
export const list = <const I extends ScalarParam | Fields>(
  item: I,
  value: readonly NoInfer<ItemValue<I>>[],
  options: Labelled & { readonly min?: number; readonly max?: number } = {},
): ListParam<I> => {
  const { min = 0, max } = options;

  if (
    !(Number.isInteger(min) && min >= 0) ||
    (max !== undefined && !(Number.isInteger(max) && max >= min))
  )
    throw new Error(
      `list() needs a whole min of 0 or more and a whole max no smaller, got ${min} and ${max}.`,
    );

  if (!isScalar(item))
    for (const [key, field] of Object.entries(item))
      if (!isScalar(field))
        throw new Error(
          `list() items are scalars or records of scalars, so field "${key}" cannot be a list. Make it a list param of its own.`,
        );

  const declared: ListParam<I> = { kind: "list", item, value, min, ...options };

  // SAFETY: valueOf returns a list param's value with each item checked against `item`, which is ItemValue<I>[].
  return { ...declared, value: valueOf(declared, value, "list()") as ListParam<I>["value"] };
};

export const defaults = <S extends Schema>(schema: S): Values<S> =>
  // SAFETY: the entries are exactly the schema's keys, each mapped to that param's own value.
  Object.fromEntries(Object.entries(schema).map(([key, p]) => [key, p.value])) as Values<S>;

type NumberKeys<S extends Schema> = {
  [K in keyof S]: S[K] extends NumberParam ? K : never;
}[keyof S];

export type Handles<S extends Schema> = (values: Values<S>) => {
  readonly [K in NumberKeys<S>]?: Point;
};

export type Json = null | boolean | number | string | readonly Json[] | JsonObject;

export type JsonObject = { readonly [key: string]: Json };

const show = (v: Json | undefined): string => {
  if (v === undefined) return "nothing";
  const json = JSON.stringify(v) ?? String(v);

  return json.length > 40 ? `${json.slice(0, 37)}...` : json;
};

const isScalar = (p: Param | Fields): p is ScalarParam =>
  typeof p.kind === "string" && p.kind !== "list";

const isRecord = (v: Json | undefined): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNumber = (v: Json | undefined): v is number => typeof v === "number";

const isString = (v: Json | undefined): v is string => typeof v === "string";

const NAMED_EASES = ["linear", "in", "out", "inOut", "pop", "hold"] as const;

const easeOf = (v: Json | undefined, path: string): Ease => {
  const named = NAMED_EASES.find((name) => name === v);

  if (named) return ease[named];

  if (isRecord(v)) {
    if (v.kind === "linear") return ease.linear;

    if (v.kind === "bezier" && Array.isArray(v.points) && v.points.length === 4)
      return ease.bezier(
        Number(v.points[0]),
        Number(v.points[1]),
        Number(v.points[2]),
        Number(v.points[3]),
      );

    if (v.kind === "steps") return ease.steps(Number(v.count));
  }

  throw new Error(
    `${path} needs an ease: ${NAMED_EASES.map((n) => `"${n}"`).join(", ")}, or { "kind": "bezier", "points": [x1, y1, x2, y2] }, got ${show(v)}.`,
  );
};

const valueOf = (p: Param, v: Json | undefined, path: string): Param["value"] => {
  switch (p.kind) {
    case "number": {
      if (!isNumber(v) || !Number.isFinite(v) || v < p.min || v > p.max)
        throw new Error(`${path} needs a number from ${p.min} to ${p.max}, got ${show(v)}.`);

      if (p.step === 1 && Number.isInteger(p.min) && !Number.isInteger(v))
        throw new Error(`${path} needs a whole number, got ${show(v)}.`);

      return v;
    }

    case "color":
      if (!isString(v))
        throw new Error(`${path} needs a hex color such as "#FF5D8F", got ${show(v)}.`);

      // SAFETY: hexOf throws unless the string is a hex color, so what it returns is one.
      return hexOf(v as Hex, path);
    case "easing":
      return easeOf(v, path);
    case "choice": {
      const option = p.options.find((o) => o === v);

      if (option === undefined)
        throw new Error(
          `${path} is one of ${p.options.map((o) => `"${o}"`).join(", ")}, got ${show(v)}.`,
        );

      return option;
    }

    case "text":
      if (!isString(v)) throw new Error(`${path} needs text, got ${show(v)}.`);

      if (p.maxLength !== undefined && v.length > p.maxLength)
        throw new Error(
          `${path} is ${v.length} characters, over its maxLength of ${p.maxLength}. Shorten it to fit.`,
        );

      return v;
    case "list": {
      if (!Array.isArray(v)) throw new Error(`${path} needs a list, got ${show(v)}.`);

      if (v.length < p.min || (p.max !== undefined && v.length > p.max))
        throw new Error(
          `${path} has ${v.length} items, and needs ${p.max === undefined ? `at least ${p.min}` : `${p.min} to ${p.max}`}.`,
        );

      const { item } = p;

      // SAFETY: each entry is read through the item's schema, so the list holds ItemValues of it.
      return v.map((entry, i) =>
        isScalar(item)
          ? valueOf(item, entry, `${path}[${i}]`)
          : fieldsOf(item, entry, `${path}[${i}]`),
      ) as ListParam["value"];
    }
  }
};

const fieldsOf = (fields: Fields, v: Json | undefined, path: string) => {
  if (!isRecord(v))
    throw new Error(
      `${path} needs an object with ${Object.keys(fields).join(", ")}, got ${show(v)}.`,
    );

  for (const key of Object.keys(v))
    if (!Object.hasOwn(fields, key))
      throw new Error(
        `${path}.${key} is not a field. An item has ${Object.keys(fields).join(", ")}.`,
      );

  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      v[key] === undefined ? field.value : valueOf(field, v[key], `${path}.${key}`),
    ]),
  );
};

/**
 * Values for `schema` read from untrusted input: a JSON string, or what `JSON.parse` returned. Every value is checked
 * against its param (type, range, options, length), a key the schema does not declare throws, and a param the input
 * leaves out keeps its default. Errors name the path, as in `highlights[2].label`.
 */
export const parse = <S extends Schema>(schema: S, json: Json): Values<S> => {
  let input = json;

  if (isString(json))
    try {
      input = JSON.parse(json);
    } catch (error) {
      throw new Error(`The params are not JSON: ${error instanceof Error ? error.message : error}`);
    }

  if (!isRecord(input))
    throw new Error(`The params need a JSON object keyed by param name, got ${show(input)}.`);
  const keys = Object.keys(schema);

  for (const key of Object.keys(input))
    if (!Object.hasOwn(schema, key))
      throw new Error(
        `"${key}" is not a param of this scene. It declares ${keys.length ? keys.join(", ") : "none"}.`,
      );

  // SAFETY: the entries are exactly the schema's keys, each read through that param.
  return Object.fromEntries(
    Object.entries(schema).map(([key, p]) => [
      key,
      input[key] === undefined ? p.value : valueOf(p, input[key], key),
    ]),
  ) as Values<S>;
};

const fromText = (p: Param | Fields | undefined, text: string): Json => {
  const asNumber = text.trim() === "" ? NaN : Number(text);

  return p?.kind === "number" && Number.isFinite(asNumber) ? asNumber : text;
};

/**
 * The Json that `parse(schema, …)` reads from entries that carry every value as text: a URL's query, string form data
 * or the CLI's `--param key=value`. A number param, or a list of numbers, reads its text as a number when it is one. A
 * list takes every entry with its key; any other key takes its last. Everything else stays text for `parse` to check,
 * so an unknown key, a number that is not one or a list of records fails there with its usual message.
 */
export const fromEntries = (
  schema: Schema,
  entries: Iterable<readonly [string, string]>,
): JsonObject => {
  const texts = new Map<string, string[]>();

  for (const [key, text] of entries) {
    const known = texts.get(key);

    if (known) known.push(text);
    else texts.set(key, [text]);
  }

  return Object.fromEntries(
    [...texts].map(([key, all]) => {
      const p = Object.hasOwn(schema, key) ? schema[key] : undefined;

      return [
        key,
        p?.kind === "list" ? all.map((text) => fromText(p.item, text)) : fromText(p, all.at(-1)!),
      ];
    }),
  );
};

const labelled = <T extends JsonObject>(schema: T, { label }: Labelled) =>
  label === undefined ? schema : { ...schema, description: label };

const scalarSchema = (p: ScalarParam) => {
  switch (p.kind) {
    case "number":
      return labelled(
        {
          type: p.step === 1 && Number.isInteger(p.min) ? "integer" : "number",
          minimum: p.min,
          maximum: p.max,
        },
        p,
      );
    case "color":
      return labelled({ type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" }, p);
    case "easing":
      return labelled(
        {
          anyOf: [
            { enum: NAMED_EASES },
            {
              type: "object",
              properties: { kind: { const: "linear" } },
              required: ["kind"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: {
                kind: { const: "bezier" },
                points: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4 },
              },
              required: ["kind", "points"],
              additionalProperties: false,
            },
            {
              type: "object",
              properties: { kind: { const: "steps" }, count: { type: "integer", minimum: 1 } },
              required: ["kind", "count"],
              additionalProperties: false,
            },
          ],
        },
        p,
      );
    case "choice":
      return labelled({ type: "string", enum: p.options }, p);
    case "text":
      return labelled(
        p.maxLength === undefined ? { type: "string" } : { type: "string", maxLength: p.maxLength },
        p,
      );
  }
};

const defaulted = (p: ScalarParam) =>
  p.kind === "easing" ? scalarSchema(p) : { ...scalarSchema(p), default: p.value };

const listSchema = (p: ListParam) => {
  const { item } = p;

  const items = isScalar(item)
    ? scalarSchema(item)
    : {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(item).map(([key, field]) => [key, defaulted(field)]),
        ),
        additionalProperties: false,
      };

  // SAFETY: a list's value holds only what its items' kinds read from JSON.
  const schema = { type: "array", items, minItems: p.min, default: p.value as Json };

  return labelled(p.max === undefined ? schema : { ...schema, maxItems: p.max }, p);
};

/**
 * A JSON Schema describing what `parse(schema, json)` accepts, to hand to a model or a form. No key is required: a
 * param the input leaves out keeps its default.
 */
export const jsonSchema = (schema: Schema) =>
  ({
    type: "object",
    properties: Object.fromEntries(
      Object.entries(schema).map(([key, p]) => [
        key,
        p.kind === "list" ? listSchema(p) : defaulted(p),
      ]),
    ),
    additionalProperties: false,
  }) satisfies JsonObject;
