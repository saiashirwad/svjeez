import type { ElementProps } from "./el";
import type { Tag } from "./attributes";
import { children, node, type Child, type Props, type SvgNode } from "./svg";

export const Fragment = Symbol.for("svjeez.fragment");

type Component = (props: Props) => SvgNode | null;

const isComponent = (type: string | typeof Fragment | Component): type is Component =>
  typeof type === "function";

/** The automatic JSX runtime. Elements compile to the svjeez AST; components are pure functions of props. */
export const jsx = (
  type: string | typeof Fragment | Component,
  props: Props | null,
): SvgNode => {
  const values = props ?? {};

  if (type === Fragment) return { kind: "fragment", children: children(values.children) };

  if (isComponent(type)) return type(values) ?? { kind: "fragment", children: [] };

  return node(type, values);
};

export const jsxs = jsx;

export const jsxDEV = jsx;

type Intrinsic<T extends Tag> = ElementProps<T> & {
  readonly children?: Child;
  readonly key?: string | number;
};

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
