import { createElement, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { isFunction, withCallbacks } from "../callbacks.ts";
import type { BrowserAdapter } from "../framework.ts";
import type { Bag, Fn, Prop } from "../props.ts";

/** A React component as a value: a function, or a `memo`/`forwardRef` object around one (`type` / `render`). */
interface Wrapped {
  type?: Prop;
  render?: Prop;
}

const isClass = (component: ComponentType<Bag>): boolean =>
  Boolean(component.prototype?.isReactComponent);

/**
 * `component`, called with props whose missing callbacks are no-ops. React copies the props it is given, so the proxy
 * has to go in at the component's own call. Class components cannot be called, so they keep their props as they are.
 */
const forgiving = (component: ComponentType<Bag>): ComponentType<Bag> => {
  if (isFunction(component)) {
    if (isClass(component)) return component;

    const render: Fn = component;
    const call = (props: Bag, ...rest: unknown[]) => render(withCallbacks(props), ...rest);

    // SAFETY: a function component stays one, with the original's statics (`displayName`, `defaultProps`).
    return Object.assign(call, component) as ComponentType<Bag>;
  }

  // SAFETY: a component that is not a function is a memo or forwardRef object, with the inner one under `type` or `render`.
  const wrapped = component as Wrapped;

  for (const key of ["type", "render"] as const) {
    const inner = wrapped[key];

    if (!isFunction(inner)) continue;

    // SAFETY: `inner` is a component function (`isFunction`); the rewrapped object is the same kind of component as `component`.
    const rewrapped = { ...component, [key]: forgiving(inner as ComponentType<Bag>) };

    // SAFETY: as above.
    return rewrapped as ComponentType<Bag>;
  }

  return component;
};

let root: Root | undefined;
let current: ComponentType<Bag> | undefined;

const adapter: BrowserAdapter<ComponentType<Bag>> = {
  mount(component, props, el) {
    current = forgiving(component);
    root = createRoot(el);
    this.update(props);
  },
  update(props) {
    flushSync(() => root!.render(createElement(current!, props)));
  },
  unmount() {
    root?.unmount();
  },
};

export default adapter;
