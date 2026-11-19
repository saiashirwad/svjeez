export type Fn = (...args: any[]) => any;

/** Anything a caller can put in a prop, before it is checked. */
export type Prop =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Fn
  | readonly Prop[]
  | Bag;

export interface Bag {
  [key: string]: Prop;
}

/**
 * The props type of a component: React's (`(props) => node`), Svelte 5's (`Component<Props>`) or a Svelte class component.
 * Add a branch for a new framework.
 */
export type PropsOf<C> = C extends unknown
  ? "z_$$bindings" extends keyof C
    ? C extends (this: void, internals: never, props: infer P) => any
      ? P
      : never
    : C extends abstract new (options: infer O) => any
      ? O extends { props?: infer P }
        ? P
        : never
      : C extends (props: infer P, ...rest: never[]) => any
        ? unknown extends P
          ? {}
          : P
        : never
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
  readonly data: Bag;
  readonly fns: readonly string[];
}

const isText = (value: Prop): value is string => typeof value === "string";
const isFn = (value: Prop): value is Fn => typeof value === "function";
const isNumber = (value: Prop): value is number => typeof value === "number";
const isBool = (value: Prop): value is boolean => typeof value === "boolean";
const isList = (value: Prop): value is readonly Prop[] => Array.isArray(value);
const isBag = (value: Prop): value is Bag => typeof value === "object" && value !== null;

/** What a value is, for error messages: "Date", "Map", "Symbol", "Function". */
const kind = (value: Prop): string => Object.prototype.toString.call(value).slice(8, -1);

const check = (value: Prop, path: string, seen: Prop[]): void => {
  if (value === null || isText(value) || isBool(value)) return;

  if (isNumber(value)) {
    if (!Number.isFinite(value)) throw new Error(`${path} is ${value}, which JSON cannot hold.`);

    return;
  }

  if (isFn(value))
    throw new Error(
      `${path} is a function. Only top-level props can be functions (they become no-ops).`,
    );

  if (!isList(value) && !isBag(value))
    throw new Error(
      `${path} is ${kind(value) === "Undefined" ? "undefined" : `a ${kind(value)}`}. Props must be JSON: strings, numbers, booleans, null, arrays and plain objects.`,
    );

  if (seen.includes(value)) throw new Error(`${path} refers back to itself.`);

  const proto = Object.getPrototypeOf(value);

  if (!isList(value) && proto !== Object.prototype && proto !== null)
    throw new Error(
      `${path} is a ${kind(value) === "Object" ? proto.constructor.name : kind(value)}, which is not JSON. Pass plain data (a Date as an ISO string, a Map as an object).`,
    );

  seen.push(value);

  if (isList(value)) value.forEach((item, i) => check(item, `${path}[${i}]`, seen));
  else
    for (const [key, item] of Object.entries(value))
      if (item !== undefined) check(item, `${path}.${key}`, seen);

  seen.pop();
};

/** Splits props into JSON data and function names, throwing a clear error on anything JSON cannot carry. `where` names the call in the error. */
export const serializeProps = (props: Bag, where: string): Wire => {
  const data: Bag = {};
  const fns: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (isFn(value)) fns.push(key);
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
