import { caller } from "./svg/traced";
import { remember } from "./author/identity";
import { Fragment, build, componentName, type Key } from "./jsx-runtime";
import type { Child, SceneElement } from "./author/nodes";

type Component<P> = (props: P) => SceneElement;

type ChildOf<P> = P extends { readonly children?: unknown } ? P["children"] : never;

/** A component's props as `h` takes them: `key` joins them, and children come after them as arguments. */
export type HProps<P> = Omit<P, "children"> & { readonly key?: Key };

/**
 * Builds a node without JSX: `h(Shape, { geometry: circle(8) })` is `<Shape geometry={circle(8)} />`.
 * Children follow the props, as in `h(Group, null, a, b)`; `null` stands for no props.
 */
export function h(type: typeof Fragment, props?: null, ...children: Child[]): SceneElement;
export function h<P>(
  type: Component<P>,
  props?: NoInfer<HProps<P>> | null,
  ...children: NoInfer<ChildOf<P>>[]
): SceneElement;
export function h(
  type: Component<never> | typeof Fragment,
  props?: { readonly key?: Key } | null,
  ...children: readonly unknown[]
): SceneElement {
  const { key, ...rest } = props ?? {};

  // SAFETY: the overloads typed rest and children against the component's own props; this rebuilds them as JSX passes them.
  const full = (
    children.length === 0
      ? rest
      : { ...rest, children: children.length === 1 ? children[0] : children }
  ) as never;

  const source = caller();

  return remember(build(type, full, key, source), source, componentName(type));
}

export { Fragment };
