import { el, type SvgNode } from "svg-motion";

export interface Part {
  /** Larger is nearer the camera; the layer paints far to near. */
  readonly depth: number;
  readonly node: SvgNode;
}

/** Paint a set of 3D pieces in painter's order. */
export const layer = (parts: readonly Part[]): SvgNode =>
  el.g({}, [...parts].sort((a, b) => a.depth - b.depth).map((part) => part.node));
