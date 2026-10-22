import type { Attrs, Tag } from "./attributes";
import type { AnimatedTag, TagChannels } from "./channels";
import type { Stack } from "./motion";
import { children, node, type Child, type SvgNode } from "./svg";

export const Fragment = Symbol.for("svg-motion.fragment");

type Component = (props: Record<string, unknown>) => SvgNode | null;

/** The automatic JSX runtime. Elements compile to the svg-motion AST; components are pure functions of props. */
export const jsx = (type: string | typeof Fragment | Component, props: Record<string, unknown> | null): SvgNode => {
  const values = props ?? {};
  if (type === Fragment) return { kind: "fragment", children: children(values.children) };
  if (typeof type === "function") return type(values) ?? { kind: "fragment", children: [] };
  return node(type, values);
};

export const jsxs = jsx;

export const jsxDEV = (type: string | typeof Fragment | Component, props: Record<string, unknown> | null): SvgNode => jsx(type, props);

type Intrinsic<T extends Tag> = Attrs<T> & { readonly children?: Child; readonly key?: string | number } & (T extends AnimatedTag
    ? { readonly animation?: Stack<TagChannels<T>> }
    : {});

export namespace JSX {
  export type Element = SvgNode;
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export interface ElementChildrenAttribute {
    children: {};
  }
  export type IntrinsicElements = { [T in Tag]: Intrinsic<T> };
}
