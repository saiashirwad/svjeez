import { easeBetween } from "./ease-at";
import { DEFAULT_EASE, EPSILON, ease, isHold } from "./time";
import { isCurved } from "./curve";
import type { Animated, Key, Lane, Layer, Vec } from "./ir";
import { isLane, mapLane } from "./lane";
import { mixNumber, mixVec, same, type Mix } from "./steps";
import { valueAt as sampleAt } from "./sample";
import { add } from "./vec";

const valueAt = <T>(lane: Lane<T>, t: number, mix: Mix<T>): T =>
  sampleAt(lane, t, (a, b, amount) => mix(a, b, amount, "a folded layer"));

const windows = <T>(lane: Lane<T>): (readonly [number, number])[] =>
  lane.keys.slice(1).flatMap((key, i) => {
    const from = lane.keys[i]!;

    if (same(from.value, key.value)) return [];

    return [isHold(key.ease) ? [key.t, key.t] : [from.t, key.t]];
  });

const meet = ([s, e]: readonly [number, number], [s2, e2]: readonly [number, number]): boolean =>
  s === e ? s > s2 + EPSILON && s < e2 + EPSILON : s < e2 - EPSILON && s2 < e - EPSILON;

const apart = <T>(a: Lane<T>, b: Lane<T>): boolean =>
  windows(a).every((one) => windows(b).every((other) => !meet(one, other) && !meet(other, one)));

const easeOver = <T>(lane: Lane<T>, t0: number, t1: number) => {
  const next = lane.keys.findIndex((key) => key.t >= t1 - EPSILON);

  if (next <= 0) return undefined;
  const [from, to] = [lane.keys[next - 1]!, lane.keys[next]!];

  if (same(from.value, to.value)) return undefined;
  const span = to.t - from.t;

  return easeBetween(
    to.ease ?? DEFAULT_EASE,
    (t0 - from.t) / span,
    (t1 - from.t) / span,
    "a folded layer",
  );
};

const joined = <T>(
  a: Animated<T>,
  b: Animated<T>,
  op: (a: T, b: T) => T,
  mix: Mix<T>,
): Animated<T> | undefined => {
  if (!isLane(a)) {
    if (!isLane(b)) return op(a, b);

    return isCurved(b.keys) ? undefined : mapLane(b, (value) => op(a, value));
  }

  if (isCurved(a.keys)) return undefined;

  if (!isLane(b)) return mapLane(a, (value) => op(value, b));

  if (isCurved(b.keys)) return undefined;

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

const timesVec = (a: Vec, b: Vec): Vec => [a[0] * b[0], a[1] * b[1]];

const always = <T>(value: Animated<T>, rest: T): boolean =>
  isLane(value) ? value.keys.every((key) => same(key.value, rest)) : same(value, rest);

const isUniform = (value: Animated<Vec>): boolean =>
  (isLane(value) ? value.keys.map((key) => key.value) : [value]).every(
    ([x, y]) => Math.abs(x - y) < 1e-9,
  );

const fold = (outer: Layer, inner: Layer): Layer | undefined => {
  const still =
    always(inner.offset, [0, 0]) || (always(outer.rotate, 0) && always(outer.scale, [1, 1]));

  const turns = always(inner.rotate, 0) || isUniform(outer.scale);

  // The inner layer's skew stays the innermost step, so it carries over; an outer skew sits between the two turns and can't merge.
  if (!still || !turns || !always(outer.skew, 0)) return undefined;
  const offset = joined(outer.offset, inner.offset, add, mixVec);
  const rotate = joined(outer.rotate, inner.rotate, (a, b) => a + b, mixNumber);
  const scale = joined(outer.scale, inner.scale, timesVec, mixVec);
  const opacity = joined(outer.opacity, inner.opacity, (a, b) => a * b, mixNumber);

  if (!offset || rotate === undefined || !scale || opacity === undefined) return undefined;

  return { offset, rotate, scale, skew: inner.skew, opacity };
};

export const foldLayers = (layers: readonly Layer[]): Layer[] => {
  const folded: Layer[] = [];

  for (const layer of [...layers].reverse()) {
    const one = folded[0] && fold(layer, folded[0]);

    if (one) folded[0] = one;
    else folded.unshift(layer);
  }

  return folded;
};
