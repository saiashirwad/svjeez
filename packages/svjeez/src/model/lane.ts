import type { Animated, Lane, Vec } from "./ir";

/** Whether a value moves: a lane, rather than a value that holds. */
export const isLane = <T>(value: Animated<T>): value is Lane<T> =>
  typeof value === "object" && value !== null && "kind" in value && value.kind === "lane";

const isVec = (value: number | Vec): value is Vec => Array.isArray(value);

/** A scale as the model holds it: across and down. */
export const pair = (value: number | Vec): Vec => (isVec(value) ? value : [value, value]);

/** A value's first key, or the value itself: what it is at rest, for measuring and placing. */
export const atRest = <T>(value: Animated<T>): T => (isLane(value) ? value.keys[0].value : value);

/** The same lane with every value passed through `change`. Its times and eases stay, so it moves in step. */
export const mapLane = <T, U>(lane: Lane<T>, change: (value: T) => U): Lane<U> => {
  const [head, next, ...rest] = lane.keys.map((key) => ({ ...key, value: change(key.value) }));

  return { ...lane, keys: [head!, next!, ...rest] };
};
