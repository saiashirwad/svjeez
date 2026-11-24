/** The type guards every module shares, so `typeof` and `Array.isArray` narrow a value in one place. */

import type { Vec } from "./ir";

export const isNumber = (value: unknown): value is number => typeof value === "number";

export const isString = (value: unknown): value is string => typeof value === "string";

export const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

/** `Array.isArray` for a union: keeps its list members, readonly tuples like `Vec` included, which the built-in does not narrow. */
export const isArray = <T>(value: T): value is Extract<T, readonly unknown[]> =>
  Array.isArray(value);

/** A point: two finite numbers. */
export const isPoint = (value: unknown): value is Vec =>
  Array.isArray(value) && value.length === 2 && value.every((n) => Number.isFinite(n));
