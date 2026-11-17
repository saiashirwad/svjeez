import { type Drawn, type Font, type Spanned, type SvgNode } from "svjeez";
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

/**
 * The largest whole font size, from `size` down, at which every one of `texts` set in `face` is at most `width` px
 * wide. Below `floor` it gives up and returns undefined, so the caller can say what to shorten.
 */
export const fitSize = (
  face: Font,
  texts: readonly string[],
  size: number,
  width: number,
  floor: number,
): number | undefined => {
  const widest = Math.max(0, ...texts.map((text) => face.measure(text, size)));
  const fitted = widest <= width ? size : Math.floor((size * width) / widest);

  return fitted >= floor ? fitted : undefined;
};

/** How many characters of `face` fit in `width` px at `size`, judged by an average lowercase letter. */
export const charsIn = (face: Font, width: number, size: number) =>
  Math.floor(width / (face.measure("abcdefghijklmnopqrstuvwxyz", size) / 26));
