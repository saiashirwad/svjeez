import { caller } from "./svg/traced";
import { remember } from "./author/identity";
import { Fragment, build, componentName, type Key } from "./jsx-runtime";
import type { Child, SceneElement } from "./author/nodes";

type Component<P> = (props: P) => SceneElement;

type ChildOf<P> = P extends { readonly children?: unknown } ? P["children"] : never;

/** A component's props as `h` takes them: `key` joins them, and children come after them as arguments. */
export type HProps<P> = Omit<P, "children"> & { readonly key?: Key };

type Optional<P, K extends PropertyKey> = {} extends Pick<P, Extract<K, keyof P>> ? true : false;

/** Children go to the component as one value for one argument and as an array for several, so several only fit where the children type takes an array. */
type TakesMany<C> = [Extract<C, readonly unknown[]>] extends [never] ? false : true;

type ChildItem<C> = Exclude<C, readonly unknown[]> | Extract<C, readonly unknown[]>[number];

type HChildren<P> = [ChildOf<P>] extends [never]
  ? []
  : Optional<P, "children"> extends true
    ? TakesMany<ChildOf<P>> extends true
      ? [child?: ChildOf<P> | ChildItem<ChildOf<P>>, ...more: ChildItem<ChildOf<P>>[]]
      : [child?: ChildOf<P>]
    : TakesMany<ChildOf<P>> extends true
      ? [child: ChildOf<P> | ChildItem<ChildOf<P>>, ...more: ChildItem<ChildOf<P>>[]]
      : [child: ChildOf<P>];

/** Props are optional (and may be `null`) only when the component needs neither props nor children. */
type HArgs<P> =
  {} extends HProps<P>
    ? Optional<P, "children"> extends true
      ? [props?: HProps<P> | null, ...children: HChildren<P>]
      : [props: HProps<P> | null, ...children: HChildren<P>]
    : [props: HProps<P>, ...children: HChildren<P>];

/**
 * Builds a node without JSX: `h(Shape, { geometry: circle(8) })` is `<Shape geometry={circle(8)} />`.
 * Children follow the props, as in `h(Group, null, a, b)`; `null` stands for no props.
 */
export function h(type: typeof Fragment, props?: null, ...children: Child[]): SceneElement;
export function h<P>(type: Component<P>, ...args: NoInfer<HArgs<P>>): SceneElement;
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
