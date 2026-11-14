import type { TagChannels } from "./channels";
import { el } from "./el";
import { num } from "./format";
import type { Point } from "./geometry";
import type { Stack } from "./motion";
import type { Child, SvgNode } from "./svg";

export interface PivotProps {
  /** The point `rotate` and `scale` turn about, in the coordinates the children are drawn in. Default 0,0. */
  readonly at?: Point;
  readonly animation?: Stack<TagChannels<"g">>;
  readonly children?: Child;
}

/** A group whose `rotate` and `scale` turn about `at` instead of the center of what it holds, through every layer of its stack. */
export const Pivot = ({ at = { x: 0, y: 0 }, animation, children }: PivotProps): SvgNode =>
  el.g(
    {
      style: { transformBox: "view-box", transformOrigin: `${num(at.x)}px ${num(at.y)}px` },
      animation,
    },
    children,
  );
