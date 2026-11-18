import type { Animated, Key, Lane, Vec } from "./ir";

export const isLane = <T>(value: Animated<T>): value is Lane<T> =>
  typeof value === "object" && value !== null && "kind" in value && value.kind === "lane";

const isVec = (value: number | Vec): value is Vec => Array.isArray(value);

export const pair = (value: number | Vec): Vec => (isVec(value) ? value : [value, value]);

export const atRest = <T>(value: Animated<T>): T => (isLane(value) ? value.keys[0].value : value);

export const mapLane = <T, U>(lane: Lane<T>, change: (value: T) => U): Lane<U> => {
  const [head, next, ...rest] = lane.keys;
  const mapKey = (key: Key<T>): Key<U> => ({ ...key, value: change(key.value) });
  const keys: Lane<U>["keys"] = [mapKey(head), mapKey(next), ...rest.map(mapKey)];

  return { ...lane, keys };
};
