import { type Drawn, type Spanned, type SvgNode } from "svjeez";
import type { Rect } from "svjeez/geometry";

/** What a template draws, as a `Drawn` without parts: a deck slide places it, and the template's build renders it. */
export const block = (node: SvgNode, played: Spanned, bounds: Rect): Drawn => ({
  node,
  span: played,
  bounds,
  parts: [],
  part: (id) => {
    throw new Error(`A template block has no parts, so it has none named "${id}".`);
  },
});
