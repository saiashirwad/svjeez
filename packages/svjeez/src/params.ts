// A scene's editable parameters as plain data. A scene exports a schema and stays a pure function of the values:
//
//   export const params = { flowers: count(5, { min: 1, max: 12 }), petal: color("#FF5D8F") };
//   export default (p = defaults(params)) => render(...);
//
// The schema crosses a worker boundary as is, and a page reads it to draw controls and to keep values in range.
import type { Hex } from "./color";
import type { Point } from "./layout/box";
import type { Ease } from "./motion";

interface Labelled {
  /** What a control calls the value, when the key alone does not say. */
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

export type Param = NumberParam | ColorParam | EasingParam | ChoiceParam;

export type Schema = { readonly [key: string]: Param };

export type Values<S extends Schema> = { readonly [K in keyof S]: S[K]["value"] };

type Range = Pick<NumberParam, "min" | "max">;

type Extras = Partial<Pick<NumberParam, "step" | "unit" | "scale" | "label">>;

const check = (name: string, p: NumberParam): NumberParam => {
  const at = `${name}(${p.value})`;

  if (!(p.min < p.max)) throw new Error(`${at} needs min below max, got ${p.min} and ${p.max}.`);

  if (!(p.step > 0)) throw new Error(`${at} needs a positive step, got ${p.step}.`);

  if (p.value < p.min || p.value > p.max)
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
  value,
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
  if (!options.includes(value))
    throw new Error(`choice("${value}") is not one of ${options.map((o) => `"${o}"`).join(", ")}.`);

  return { kind: "choice", value, options, ...extras };
};

/** Every param's declared value: what the scene draws when nobody has touched a control. */
export const defaults = <S extends Schema>(schema: S): Values<S> =>
  // SAFETY: the entries are exactly the schema's keys, each mapped to that param's own value.
  Object.fromEntries(Object.entries(schema).map(([key, p]) => [key, p.value])) as Values<S>;

const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;

/** `v` clamped into the param's range and rounded to its step, without float dust. */
export const fit = (p: NumberParam, v: number): number => {
  const stepped =
    p.min + Math.round((Math.min(p.max, Math.max(p.min, v)) - p.min) / p.step) * p.step;

  return Number(Math.min(p.max, stepped).toFixed(Math.max(decimals(p.step), decimals(p.min))));
};

/** Where `v` sits along a slider for `p`, 0 to 1, on the param's scale. */
export const positionOf = (p: NumberParam, v: number): number =>
  p.scale === "log" ? Math.log(v / p.min) / Math.log(p.max / p.min) : (v - p.min) / (p.max - p.min);

/** The value at `position`, 0 to 1, along a slider for `p`, fitted to its step. */
export const valueAt = (p: NumberParam, position: number): number =>
  fit(
    p,
    p.scale === "log" ? p.min * (p.max / p.min) ** position : p.min + position * (p.max - p.min),
  );

/** `patch` with every number fitted to its param, so a control can pass a raw reading and stay in range. */
export const fitValues = <S extends Schema>(
  schema: S,
  patch: Partial<Values<S>>,
): Partial<Values<S>> =>
  // SAFETY: each entry keeps its key, and a number param's value, a number, is replaced by a fitted number.
  Object.fromEntries(
    Object.entries(patch).map(([key, value]) => {
      const p = schema[key];

      return [key, p?.kind === "number" ? fit(p, Number(value)) : value];
    }),
  ) as Partial<Values<S>>;

/** The schema with each param holding its value from `values`, so a control reads kind and value off one param. */
export const withValues = <S extends Schema>(schema: S, values: Values<S>): S => {
  const current: { readonly [key: string]: Param["value"] } = values;

  // SAFETY: Values<S> gives each key a value of its own param's kind, so every param keeps its kind.
  return Object.fromEntries(
    Object.entries(schema).map(([key, p]) => [key, { ...p, value: current[key] ?? p.value }]),
  ) as S;
};

type NumberKeys<S extends Schema> = {
  [K in keyof S]: S[K] extends NumberParam ? K : never;
}[keyof S];

/** Where the handle for each number param sits in the picture, in scene coordinates, given every value. */
export type Handles<S extends Schema> = (values: Values<S>) => {
  readonly [K in NumberKeys<S>]?: Point;
};

/**
 * `v` moved as far as a drag `by` carries a handle that sits at `at(v)`. The drag counts only along the way the handle
 * travels as `v` grows, so a handle on an arc follows the arc. The result is clamped to the range but not rounded, so a
 * slow drag still adds up: `fit` it for the value to write.
 */
export const follow = (p: NumberParam, at: (v: number) => Point, v: number, by: Point): number => {
  const h = (p.max - p.min) / 10_000;
  const [from, to] = [at(v), at(v + h)];
  const way = { x: (to.x - from.x) / h, y: (to.y - from.y) / h };
  const length = way.x ** 2 + way.y ** 2;

  if (!length) return v;

  return Math.min(p.max, Math.max(p.min, v + (by.x * way.x + by.y * way.y) / length));
};
