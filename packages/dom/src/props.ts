/** Any function. */
type Fn = (...args: never[]) => unknown;

/** The props type of a component: React's (`(props) => node`) or Svelte 5's (`Component<Props>`). Add a branch for a new framework. */
export type PropsOf<C> = "z_$$bindings" extends keyof C
  ? C extends (this: void, internals: never, props: infer P) => unknown
    ? P
    : never
  : C extends (props: infer P, ...rest: never[]) => unknown
    ? unknown extends P
      ? {}
      : P
    : never;

/** `T` if it survives `JSON.stringify` unchanged. Functions, `Date`, `Map`, class instances with methods become `never`. */
export type Json<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends Fn
    ? never
    : T extends readonly (infer U)[]
      ? readonly Json<U>[]
      : T extends object
        ? { [K in keyof T]: Json<T[K]> }
        : never;

type FnKeys<P> = {
  [K in keyof P]-?: [Exclude<P[K], undefined>] extends [Fn] ? K : never;
}[keyof P];

type Flat<T> = { [K in keyof T]: T[K] } & {};

/**
 * What crosses to the browser: data props (required, JSON only) and function props (optional: the browser gets no-op
 * stand-ins for the ones you pass).
 */
export type WireProps<P> = Flat<
  { [K in keyof P as K extends FnKeys<P> ? never : K]: Json<P[K]> } & {
    [K in keyof P as K extends FnKeys<P> ? K : never]?: P[K];
  }
>;

/** The props `component(C, props)` takes. */
export type PropsFor<C> = WireProps<PropsOf<C>>;

/** What goes over the wire: JSON data, and the names of the props that were functions. */
export interface Wire {
  readonly data: Record<string, unknown>;
  readonly fns: readonly string[];
}

const kind = (value: unknown): string => {
  if (value === null) return "null";

  if (typeof value !== "object") return typeof value;

  const proto: unknown = Object.getPrototypeOf(value);

  return Array.isArray(value)
    ? "array"
    : (proto?.constructor?.name ?? "an object with no prototype");
};

const check = (value: unknown, path: string, seen: object[]): void => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} is ${value}, which JSON cannot hold.`);

    return;
  }

  if (typeof value !== "object")
    throw new Error(
      `${path} is a ${typeof value}. Props must be JSON: strings, numbers, booleans, null, arrays and plain objects.`,
    );

  if (seen.includes(value)) throw new Error(`${path} refers back to itself.`);

  const proto: unknown = Object.getPrototypeOf(value);

  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null)
    throw new Error(
      `${path} is ${kind(value) === "Date" ? "a Date" : `a ${kind(value)}`}, which is not JSON. Pass plain data (a Date as an ISO string, a Map as an object).`,
    );

  seen.push(value);

  if (Array.isArray(value)) value.forEach((item, i) => check(item, `${path}[${i}]`, seen));
  else
    for (const [key, item] of Object.entries(value))
      if (item !== undefined) check(item, `${path}.${key}`, seen);

  seen.pop();
};

/** Splits props into JSON data and function names, throwing a clear error on anything JSON cannot carry. `where` names the call in the error. */
export const serializeProps = (props: object, where: string): Wire => {
  const data: Record<string, unknown> = {};
  const fns: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "function") fns.push(key);
    else if (value !== undefined) {
      try {
        check(value, key, []);
      } catch (error) {
        throw new Error(`${where}: props.${error instanceof Error ? error.message : error}`);
      }

      data[key] = value;
    }
  }

  return { data, fns };
};
