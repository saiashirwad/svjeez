import type { Animated, Lane, Vec } from "./ir";

export const isLane = <T>(value: Animated<T>): value is Lane<T> =>
  typeof value === "object" && value !== null && "kind" in value && value.kind === "lane";

const isVec = (value: number | Vec): value is Vec => Array.isArray(value);

/** A scale as the model holds it: across and down. */
export const pair = (value: number | Vec): Vec => (isVec(value) ? value : [value, value]);
