import { caller } from "./svg/traced";
import { remember } from "./author/identity";
import { flat, type Child, type SceneElement } from "./author/nodes";

export const Fragment = Symbol.for("svjeez.scene.fragment");

type Component<P> = (props: P) => SceneElement;

const isFragment = <P>(type: Given<P>): type is typeof Fragment => type === Fragment;

/** The runtime's input, with the lowercase tag an untyped file can still hand it. */
type Given<P> = Component<P> | typeof Fragment | string;

const isTag = <P>(type: Given<P>): type is string => typeof type === "string";

export const build = <P extends { readonly children?: Child }>(
  type: Given<P>,
  props: P,
  key?: string,
): SceneElement => {
  if (isFragment(type)) return { type: "fragment", children: flat(props.children) };

  if (isTag(type))
    throw new Error(
      `JSX holds <${type}>, an SVG tag, which a scene doesn't draw: every node is a component, such as <Shape geometry={rect(w, h)} />.`,
    );

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
