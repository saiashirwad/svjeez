import { caller } from "./svg/traced";
import { keyText, remember, sourceFrom } from "./author/identity";
import { componentMeta } from "./author/component";
import { scopeNow } from "./author/scope";
import { flat, type Child, type SceneElement } from "./author/nodes";
import { SceneError } from "./model/scene-error";
import type { JsxSource } from "./author/sources";

export const Fragment = Symbol.for("svjeez.scene.fragment");

type Component<P> = (props: P) => SceneElement;

const isFragment = <P>(type: Given<P>): type is typeof Fragment => type === Fragment;

type Given<P> = Component<P> | typeof Fragment | string;

const isTag = <P>(type: Given<P>): type is string => typeof type === "string";

/** The name `component()` gave it, which survives minification, or else the function's own. */
export const componentName = <P>(type: Given<P>): string | undefined =>
  isFragment(type) || isTag(type)
    ? undefined
    : (componentMeta(type)?.name ?? (type.name || undefined));

/** What JSX takes as a key: text, or a number such as a list index. */
export type Key = string | number;

export const build = <P extends { readonly children?: Child; readonly id?: string }>(
  type: Given<P>,
  props: P,
  key: Key | undefined,
  source: JsxSource | undefined,
): SceneElement => {
  if (isFragment(type)) return { type: "fragment", children: flat(props.children) };

  if (isTag(type))
    throw new SceneError(
      `JSX holds <${type}>, an SVG tag, which a scene doesn't draw: every node is a component, such as <Shape geometry={rect(w, h)} />.`,
      "Write components, and put the JSX pragma at the top of the file.",
      { node: `<${type}>`, ...(source && { source: sourceFrom(source) }) },
    );

  // The component runs when the scene is built, top-down, with the contexts and ids around it.
  return {
    type: "call",
    component: type,
    props,
    ...(key !== undefined && { key: keyText(key, source && sourceFrom(source)) }),
    scope: scopeNow(),
  };
};

export function jsx(
  type: typeof Fragment,
  props: { readonly children?: Child },
  key?: Key,
): SceneElement;
export function jsx<P>(type: Component<P>, props: P, key?: Key): SceneElement;
export function jsx<P extends { readonly children?: Child; readonly id?: string }>(
  type: Component<P> | typeof Fragment,
  props: P,
  key?: Key,
): SceneElement {
  const source = caller();

  return remember(build(type, props, key, source), source, componentName(type));
}

export { jsx as jsxs, jsx as jsxDEV };

export namespace JSX {
  export type Element = SceneElement;
  export interface IntrinsicAttributes {
    key?: Key;
    /** Names the node for ref("id") and `svg.emit(scene, { ids: true })`; a component with one scopes the ids inside it. */
    id?: string;
  }
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicElements {}
}
