import { fragment, node, type ElementProps, type SvgNode } from "./svg";

export const Fragment = Symbol.for("svg-motion.fragment");

export type Component<P = Record<string, unknown>> = (props: P) => SvgNode;

type RuntimeType = string | typeof Fragment | Component<any>;

/**
 * The automatic JSX runtime. Elements compile to the svg-motion AST, not DOM.
 * Intrinsic tags are plain SVG names; components are pure functions of props.
 */
export const jsx = (type: RuntimeType, props: Record<string, unknown> | null, _key?: string | number): SvgNode => {
  const values = props ?? {};
  if (type === Fragment) {
    return fragment((values.children ?? []) as ElementProps["children"]);
  }
  if (typeof type === "function") {
    const result = (type as Component)(values);
    if (!result) return fragment([]);
    return Array.isArray(result) ? fragment(result) : result;
  }
  if (typeof type !== "string") throw new Error("Invalid JSX element type.");
  return node(type, values as ElementProps);
};

export const jsxs = jsx;

export const jsxDEV = (
  type: RuntimeType,
  props: Record<string, unknown> | null,
  key?: string | number,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): SvgNode => jsx(type, props, key);

export type SvgTag =
  | "svg"
  | "g"
  | "defs"
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "path"
  | "polygon"
  | "polyline"
  | "use"
  | "symbol"
  | "marker"
  | "mask"
  | "clipPath"
  | "pattern"
  | "linearGradient"
  | "radialGradient"
  | "stop"
  | "filter"
  | "feDropShadow"
  | "feGaussianBlur"
  | "feBlend"
  | "feMerge"
  | "feMergeNode"
  | "text"
  | "tspan"
  | "title"
  | "desc"
  | "style"
  | "image"
  | "animate"
  | "animateTransform"
  | "animateMotion"
  | "mpath"
  | "foreignObject"
  | "metadata";

export namespace JSX {
  export type Element = SvgNode;
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export interface ElementChildrenAttribute {
    children: {};
  }
  export type IntrinsicElements = {
    [K in SvgTag]: ElementProps;
  };
}
