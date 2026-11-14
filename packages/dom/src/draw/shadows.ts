import type { PathData } from "svjeez";
import { channels, clear, mapPaint } from "../paint.ts";
import type { Box, Paint, Rect, Shadow } from "../tree.ts";
import { grow, growRadii, paddingBox, rounded } from "./geometry.ts";

// A blurred shadow is drawn as a few nested, faint copies instead of through a filter. A filter on a moving shape
// re-blurs every frame at the zoomed size, which is what made zooming in stutter; plain paths stay cheap.

/** How many nested copies stand in for a blur: one for a hard shadow, up to six for a soft one. */
export const layersFor = (blur: number): number =>
  blur <= 0 ? 1 : Math.min(6, Math.max(2, Math.round(blur)));

/** Copy k of n spreads from -blur to +blur, so together they ramp off like the blur's edge. */
export const spreadAt = (blur: number, k: number, n: number): number =>
  n === 1 ? 0 : blur * ((2 * k + 1) / n - 1) * 0.8;

/** The alpha each of n stacked copies needs so the middle, where all overlap, matches the shadow's color. */
export const layerColor = (color: Paint, n: number): Paint =>
  n === 1
    ? color
    : mapPaint(color, (c) => {
        const [r, g, b, a] = channels(c);

        return `rgba(${r},${g},${b},${Math.round((1 - (1 - a) ** (1 / n)) * 1000) / 1000})`;
      });

/** `own` with as many shadows as `other`: the missing ones are clear copies of the other side's. */
const evened = (own: readonly Shadow[], other: readonly Shadow[]): Shadow[] =>
  Array.from({ length: Math.max(own.length, other.length) }, (_, i) => {
    const theirs = other[i]!;

    return own[i] ?? { ...theirs, color: clear(theirs.color) };
  });

/** Both boxes with the same number of outer shadows, so each one morphs. */
export const padShadows = (a: Box, b: Box): [Box, Box] => [
  { ...a, shadows: evened(a.shadows, b.shadows) },
  { ...b, shadows: evened(b.shadows, a.shadows) },
];

/** Both boxes with the same number of inset shadows. */
export const padInsets = (a: Box, b: Box): [Box, Box] => [
  { ...a, insets: evened(a.insets ?? [], b.insets ?? []) },
  { ...b, insets: evened(b.insets ?? [], a.insets ?? []) },
];

/** Outer shadow `i`, spread `extra` further. */
export const shadowPath = (b: Box, i: number, extra = 0): PathData => {
  const s = b.shadows[i]!;
  const by = s.spread + extra;

  return rounded(grow(b.box, by, s.x, s.y), growRadii(b.radii, by));
};

/** An inset shadow's shape: the padding box with a hole the shadow doesn't reach. Drawn with `evenodd`. */
export const insetPath = (b: Box, s: Shadow, extra = 0): PathData => {
  const { rect, radii } = paddingBox(b);
  const by = -(s.spread + extra);

  return `${rounded(rect, radii)}${rounded(grow(rect, by, s.x, s.y), growRadii(radii, by))}`;
};

/** Where outer shadows may show: `region` less the border box, since CSS draws them only outside it. */
export const outside = (b: Box, region: Rect): PathData =>
  `${rounded(region, [0, 0, 0, 0])}${rounded(b.box, b.radii)}`;
