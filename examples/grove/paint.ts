import { el, type SvgNode } from "svg-motion";

export interface Part {
  readonly depth: number;
  readonly node: SvgNode;
}

export const layer = (parts: readonly Part[]): SvgNode =>
  el.g({}, [...parts].sort((a, b) => a.depth - b.depth).map((part) => part.node));
