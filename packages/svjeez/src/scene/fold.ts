import { easeAt, splitEase } from "../ease-at";
import { EPSILON, ease, type Ease } from "../time";
import { isCurved, onCurve } from "./curve";
import type { Animated, Key, Lane, Layer, Vec } from "./ir";
import { isLane } from "./lane";
import { mixNumber, mixVec, same, type Mix } from "./steps";

/**
 * Layers folded together where that changes nothing a viewer sees, so a backend draws fewer wrappers. Two layers fold
 * when each of their values changes while the other's holds (an enter, then an exit) and the outer one's transform
 * passes through the inner one's unchanged. Folding multiplies scales and opacities and adds turns and offsets,
 * key for key, so the folded lanes are exact.
 */

const isHold = (curve: Ease | undefined): boolean => curve?.kind === "steps" && curve.count === 1;

/** The lane's value at `t`, through its eases. */
export const valueAt = <T>(lane: Lane<T>, t: number, mix: Mix<T>): T => {
  const { keys } = lane;
  const next = keys.findIndex((key) => key.t >= t - EPSILON);

  if (next < 0) return keys.at(-1)!.value;
  const to = keys[next]!;

  if (next === 0 || Math.abs(to.t - t) <= EPSILON) return to.value;
  const from = keys[next - 1]!;
  const amount = easeAt(to.ease ?? ease.out, (t - from.t) / (to.t - from.t));

  return onCurve(from, to, amount) ?? mix(from.value, to.value, amount, "a folded layer");
};

/** The same lane with every value passed through `change`. Its eases stay, so it moves in step with the original. */
export const mapped = <T, U>(lane: Lane<T>, change: (value: T) => U): Lane<U> => {
  const [head, next, ...rest] = lane.keys.map((key) => ({ ...key, value: change(key.value) }));

  return { ...lane, keys: [head!, next!, ...rest] };
};

/** When a lane changes: the way between two keys that differ, or the instant of a cut. */
const windows = <T>(lane: Lane<T>): (readonly [number, number])[] =>
  lane.keys.slice(1).flatMap((key, i) => {
    const from = lane.keys[i]!;

    if (same(from.value, key.value)) return [];

    return [isHold(key.ease) ? [key.t, key.t] : [from.t, key.t]];
  });

/** Whether two windows share a moment where one moves: a cut may land where the other starts, not where it ends. */
const meet = ([s, e]: readonly [number, number], [s2, e2]: readonly [number, number]): boolean =>
  s === e ? s > s2 + EPSILON && s < e2 + EPSILON : s < e2 - EPSILON && s2 < e - EPSILON;

const apart = <T>(a: Lane<T>, b: Lane<T>): boolean =>
  windows(a).every((one) => windows(b).every((other) => !meet(one, other) && !meet(other, one)));

/** The part of `curve` between two points of its progress, as an ease of its own. */
export const portion = (curve: Ease, from: number, to: number): Ease => {
  if (isHold(curve)) return to >= 1 - EPSILON ? curve : ease.linear;
  const tail = from > EPSILON ? splitEase(curve, from, "a folded layer")[1] : curve;

  return to < 1 - EPSILON ? splitEase(tail, (to - from) / (1 - from), "a folded layer")[0] : tail;
};

/** The ease of the way from `t0` to `t1` on `lane`, if the lane changes there. */
const easeOver = <T>(lane: Lane<T>, t0: number, t1: number): Ease | undefined => {
  const next = lane.keys.findIndex((key) => key.t >= t1 - EPSILON);

  if (next <= 0) return undefined;
  const [from, to] = [lane.keys[next - 1]!, lane.keys[next]!];

  if (same(from.value, to.value)) return undefined;
  const span = to.t - from.t;

  return portion(to.ease ?? ease.out, (t0 - from.t) / span, (t1 - from.t) / span);
};

/** Two values joined by `op` over time, or undefined when no one lane can hold the result exactly. */
const joined = <T>(
  a: Animated<T>,
  b: Animated<T>,
  op: (a: T, b: T) => T,
  mix: Mix<T>,
): Animated<T> | undefined => {
  if (!isLane(a) && !isLane(b)) return op(a, b);

  // A curve moved or scaled by another value is another curve, which mapping its keys alone would not draw.
  if ((isLane(a) && isCurved(a.keys)) || (isLane(b) && isCurved(b.keys))) return undefined;

  if (!isLane(a)) return isLane(b) ? mapped(b, (value) => op(a, value)) : op(a, b);

  if (!isLane(b)) return mapped(a, (value) => op(value, b));

  if (a.period !== b.period || !apart(a, b)) return undefined;

  const times = [...a.keys, ...b.keys]
    .map((key) => key.t)
    .sort((x, y) => x - y)
    .filter((t, i, all) => i === 0 || t - all[i - 1]! > EPSILON);

  const keys = times.map((t, i): Key<T> => {
    const value = op(valueAt(a, t, mix), valueAt(b, t, mix));

    if (i === 0) return { t, value };
    const before = times[i - 1]!;

    return { t, value, ease: easeOver(a, before, t) ?? easeOver(b, before, t) ?? ease.linear };
  });

  if (keys.every((key) => same(key.value, keys[0]!.value))) return keys[0]!.value;

  return {
    kind: "lane",
    keys: [keys[0]!, keys[1]!, ...keys.slice(2)],
    ...(a.period !== undefined && { period: a.period }),
  };
};

const add = (a: number, b: number): number => a + b;

const addVec = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];

const timesVec = (a: Vec, b: Vec): Vec => [a[0] * b[0], a[1] * b[1]];

const times = (a: number, b: number): number => a * b;

/** Whether a value is `rest` at every moment. */
const always = <T>(value: Animated<T>, rest: T): boolean =>
  isLane(value) ? value.keys.every((key) => same(key.value, rest)) : same(value, rest);

const isUniform = (value: Animated<Vec>): boolean =>
  (isLane(value) ? value.keys.map((key) => key.value) : [value]).every(
    ([x, y]) => Math.abs(x - y) < 1e-9,
  );

/** `outer` then `inner` as one layer, if that is exact. */
const fold = (outer: Layer, inner: Layer): Layer | undefined => {
  const still =
    always(inner.offset, [0, 0]) || (always(outer.rotate, 0) && always(outer.scale, [1, 1]));

  const turns = always(inner.rotate, 0) || isUniform(outer.scale);

  if (!still || !turns) return undefined;
  const offset = joined(outer.offset, inner.offset, addVec, mixVec);
  const rotate = joined(outer.rotate, inner.rotate, add, mixNumber);
  const scale = joined(outer.scale, inner.scale, timesVec, mixVec);
  const opacity = joined(outer.opacity, inner.opacity, times, mixNumber);

  if (!offset || rotate === undefined || !scale || opacity === undefined) return undefined;

  return { offset, rotate, scale, opacity };
};

/** The same layers, outermost first, with every pair that folds exactly folded into one. */
export const foldLayers = (layers: readonly Layer[]): Layer[] => {
  const folded: Layer[] = [];

  for (const layer of [...layers].reverse()) {
    const one = folded[0] && fold(layer, folded[0]);

    if (one) folded[0] = one;
    else folded.unshift(layer);
  }

  return folded;
};
