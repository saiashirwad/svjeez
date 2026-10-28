import type { Attrs } from "./attributes";
import { property } from "./properties";
import { children, node, type Child, type Element, type Props } from "./svg";

export type DefTag =
  | "linearGradient"
  | "radialGradient"
  | "pattern"
  | "clipPath"
  | "mask"
  | "filter"
  | "marker"
  | "symbol";

export type PaintServer = "linearGradient" | "radialGradient" | "pattern";

declare const refKind: unique symbol;

/** Pass it as the attribute value: `fill={bg}`, `filter={glow}`. Nominal per kind, so `clipPath={bg}` is a type error. */
export interface Ref<T extends DefTag> {
  readonly [refKind]: T;
}

export type AnyRef = Ref<DefTag>;

class Reference<T extends DefTag> implements Ref<T> {
  declare readonly [refKind]: T;

  constructor(
    readonly tag: T,
    readonly node: Element,
  ) {}

  toString(): never {
    throw new Error("A def ref is not a string. Pass it as the attribute value itself.");
  }
}

export const isRef = (value: unknown): value is AnyRef => value instanceof Reference;

// SAFETY: every AnyRef comes from make(), which only builds Reference instances.
export const refNode = (ref: AnyRef): Element => (ref as Reference<DefTag>).node;

// SAFETY: every AnyRef comes from make(), which only builds Reference instances.
export const refTag = (ref: AnyRef): DefTag => (ref as Reference<DefTag>).tag;

const make =
  <T extends DefTag>(tag: T) =>
  (attrs: Attrs<T> = {}, content?: Child): Ref<T> =>
    // SAFETY: Attrs<T> holds attribute values only, which is the part of Props that node() reads.
    new Reference(tag, { ...node(tag, attrs as Props), children: children(content) });

/**
 * `def.<tag>(attrs, children)`: emitted into <defs> only if the rendered tree references it, with a
 * deterministic id. Filters default to a userSpaceOnUse region covering the canvas.
 * `def.property(name, { syntax, inherits, initial })` is registered with @property the same way.
 */
export const def = {
  linearGradient: make("linearGradient"),
  radialGradient: make("radialGradient"),
  pattern: make("pattern"),
  clipPath: make("clipPath"),
  mask: make("mask"),
  filter: make("filter"),
  marker: make("marker"),
  symbol: make("symbol"),
  property,
} as const;
