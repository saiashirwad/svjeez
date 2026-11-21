import { caller, thrownFrom } from "./svg/traced";
import { remember, sourceFrom } from "./author/identity";
import { flat, type Child, type SceneElement } from "./author/nodes";
import { SceneError, located } from "./model/scene-error";
import type { JsxSource } from "./author/sources";

export const Fragment = Symbol.for("svjeez.scene.fragment");

type Component<P> = (props: P) => SceneElement;

const isFragment = <P>(type: Given<P>): type is typeof Fragment => type === Fragment;

type Given<P> = Component<P> | typeof Fragment | string;

const isTag = <P>(type: Given<P>): type is string => typeof type === "string";

export const componentName = <P>(type: Given<P>): string | undefined =>
  isFragment(type) || isTag(type) || !type.name ? undefined : type.name;

/** What JSX takes as a key: text, or a number such as a list index. */
export type Key = string | number;

const isCount = (key: Key): key is number => typeof key === "number";

export const build = <P extends { readonly children?: Child }>(
  type: Given<P>,
  props: P,
  key: Key | undefined,
  source: JsxSource | undefined,
): SceneElement => {
  if (isFragment(type)) return { type: "fragment", children: flat(props.children) };
  const at = source && sourceFrom(source);

  if (isTag(type))
    throw new SceneError(
      `JSX holds <${type}>, an SVG tag, which a scene doesn't draw: every node is a component, such as <Shape geometry={rect(w, h)} />.`,
      "Write components, and put the JSX pragma at the top of the file.",
      { node: `<${type}>`, ...(at && { source: at }) },
    );

  try {
    // A number key, as from .map((item, i) => ...), reads as its text. Anything else passes through for the node to
    // refuse with an error that names it.
    return type(
      key === undefined
        ? props
        : { ...props, key: isCount(key) && Number.isFinite(key) ? String(key) : key },
    );
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const thrown = thrownFrom(error);
    const name = componentName(type);

    throw located(error, {
      ...(name && { node: `<${name}>` }),
      ...((thrown ?? source) && { source: sourceFrom((thrown ?? source)!) }),
    });
  }
};

export function jsx(
  type: typeof Fragment,
  props: { readonly children?: Child },
  key?: Key,
): SceneElement;
export function jsx<P>(type: Component<P>, props: P, key?: Key): SceneElement;
export function jsx<P extends { readonly children?: Child }>(
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
  }
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicElements {}
}
