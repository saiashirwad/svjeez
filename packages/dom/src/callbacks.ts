import type { Bag, Fn, Prop } from "./props.ts";

/** The props that are callbacks by convention (`onDone`, `onSelect`): React's handlers and Svelte 5's callback props. */
export const CALLBACK = /^on[A-Z]/;

const noop = () => {};

const isName = (key: string | symbol): key is string => typeof key === "string";

/** Is `value` a function? */
export const isFunction = (value: unknown): value is Fn => typeof value === "function";

/**
 * `props`, except that a callback prop nobody passed reads as a no-op instead of `undefined`.
 * The browser has no types to tell which props are functions, so the naming convention decides.
 * Keys are not invented: `Object.keys` and `in` still see only the props that exist.
 */
export const withCallbacks = (props: Bag): Bag =>
  new Proxy(props, {
    get: (target, key) => {
      if (isName(key) && CALLBACK.test(key) && !(key in target)) return noop;

      // SAFETY: a proxy trap is also asked for symbol keys (Svelte's state marker); `Bag` just types the string ones.
      return (target as Record<string | symbol, Prop>)[key];
    },
  });
