import type { Animated, Key, Lane, Vec } from "./ir";
import { isArray } from "./guards";

export const isLane = <T>(value: Animated<T>): value is Lane<T> =>
  typeof value === "object" && value !== null && "kind" in value && value.kind === "lane";

export const pair = (value: number | Vec): Vec => (isArray(value) ? value : [value, value]);

export const atRest = <T>(value: Animated<T>): T => (isLane(value) ? value.keys[0].value : value);

export const mapLane = <T, U>(lane: Lane<T>, change: (value: T) => U): Lane<U> => {
  const [head, next, ...rest] = lane.keys;
  const mapKey = (key: Key<T>): Key<U> => ({ ...key, value: change(key.value) });
  const keys: Lane<U>["keys"] = [mapKey(head), mapKey(next), ...rest.map(mapKey)];

  return { ...lane, keys };
};
