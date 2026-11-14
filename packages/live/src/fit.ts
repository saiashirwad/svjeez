// The math a control shares with a scene's params: where a value sits on a slider, how far a drag moves it, and
// keeping a value in its range. The scene-facing kinds are in svjeez/params.
import type { Point } from "svjeez";
import type { NumberParam, Param, Schema, Values } from "svjeez/params";

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
