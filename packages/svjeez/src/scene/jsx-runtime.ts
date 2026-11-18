import { caller } from "../traced";
import { remember } from "./identity";
import { flat, type Child, type SceneElement } from "./nodes";

export const Fragment = Symbol.for("svjeez.scene.fragment");

type Component<P> = (props: P) => SceneElement;

const isFragment = <P>(type: Component<P> | typeof Fragment): type is typeof Fragment =>
  type === Fragment;

export const build = <P extends { readonly children?: Child }>(
  type: Component<P> | typeof Fragment,
  props: P,
  key?: string,
): SceneElement => {
  if (isFragment(type)) return { type: "fragment", children: flat(props.children) };

  return type(key === undefined ? props : { ...props, key });
};

export function jsx(
  type: typeof Fragment,
  props: { readonly children?: Child },
  key?: string,
): SceneElement;
export function jsx<P>(type: Component<P>, props: P, key?: string): SceneElement;
export function jsx<P extends { readonly children?: Child }>(
  type: Component<P> | typeof Fragment,
  props: P,
  key?: string,
): SceneElement {
  // Records nothing unless the CLI is tracing a file, which reads the line from the stack.
  return remember(build(type, props, key), caller());
}

export { jsx as jsxs, jsx as jsxDEV };

/** No lowercase tags: every node is a component. */
export namespace JSX {
  export type Element = SceneElement;
  export interface IntrinsicAttributes {
    key?: string;
  }
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicElements {}
}
