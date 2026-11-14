import { num, type PathData } from "svjeez";
import type { Box, Item, Radii, Rect, Transform } from "../tree.ts";

type Sides = readonly [top: number, right: number, bottom: number, left: number];

/** A rounded rectangle with a radius per corner. Corners are always arcs, so any two of these morph into each other. */
export const rounded = ({ x, y, width: w, height: h }: Rect, [tl, tr, br, bl]: Radii): PathData => {
  const arc = (r: number, ex: number, ey: number) =>
    `A${num(r)} ${num(r)} 0 0 1 ${num(ex)} ${num(ey)}`;

  return `M${num(x + tl)} ${num(y)}H${num(x + w - tr)}${arc(tr, x + w, y + tr)}V${num(y + h - br)}${arc(br, x + w - br, y + h)}H${num(x + bl)}${arc(bl, x, y + h - bl)}V${num(y + tl)}${arc(tl, x + tl, y)}Z`;
};

/** `r` grown by `by` on every side, then moved. */
export const grow = ({ x, y, width, height }: Rect, by: number, dx = 0, dy = 0): Rect => ({
  x: x - by + dx,
  y: y - by + dy,
  width: Math.max(0, width + 2 * by),
  height: Math.max(0, height + 2 * by),
});

export const growRadii = (r: Radii, by: number): Radii => [
  Math.max(0, r[0] + by),
  Math.max(0, r[1] + by),
  Math.max(0, r[2] + by),
  Math.max(0, r[3] + by),
];

const shrinkRadii = (r: Radii, [t, ri, b, l]: Sides): Radii => [
  Math.max(0, r[0] - Math.max(t, l)),
  Math.max(0, r[1] - Math.max(t, ri)),
  Math.max(0, r[2] - Math.max(b, ri)),
  Math.max(0, r[3] - Math.max(b, l)),
];

/** A rectangle with its corners. */
interface Rounded {
  readonly rect: Rect;
  readonly radii: Radii;
}

/** The padding box: inside the border, with the corners the border leaves. */
export const paddingBox = (b: Box): Rounded => {
  const widths = b.border?.widths ?? [0, 0, 0, 0];
  const [t, r, bo, l] = widths;

  return {
    rect: {
      x: b.box.x + l,
      y: b.box.y + t,
      width: b.box.width - l - r,
      height: b.box.height - t - bo,
    },
    radii: shrinkRadii(b.radii, widths),
  };
};

/** The border: the border box less the padding box. Drawn with `evenodd`. */
export const borderRing = (b: Box): PathData => {
  const inner = paddingBox(b);

  return `${rounded(b.box, b.radii)}${rounded(inner.rect, inner.radii)}`;
};

/** Everything a shadow can paint: its shape plus three standard deviations of blur. */
export const shadowBounds = (b: Box, i: number): Rect => {
  const s = b.shadows[i]!;

  return grow(b.box, s.spread + 1.5 * s.blur + 1, s.x, s.y);
};

/** The smallest rectangle around all of `rects`. */
export const union = (rects: readonly Rect[]): Rect | undefined => {
  if (rects.length === 0) return undefined;

  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));

  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
};

/** Roughly where an item can paint: its box and shadows, its text's line, all it holds. Unknown under a transform. */
const reachOf = (it: Item): Rect | undefined => {
  if (it.kind === "text") {
    const width = it.advances.at(-1) ?? it.size * it.text.length;

    return { x: it.x - 2, y: it.y - it.size * 1.2, width: width + 4, height: it.size * 1.6 };
  }

  if (it.transform) return undefined;

  if (it.kind !== "box") return it.box;

  const parts = [it.box, ...it.shadows.map((_, i) => shadowBounds(it, i))];

  if (!it.clip)
    for (const child of it.children) {
      const r = reachOf(child);

      if (!r) return undefined;

      parts.push(r);
    }

  return union(parts);
};

/**
 * Whether a box that clips has anything to clip: what it holds reaches past its padding box, less its corners. Most
 * `overflow: hidden` boxes hold everything inside, and every clip is one more thing to redraw while zooming.
 */
export const spills = (b: Box): boolean => {
  if (!b.clip) return false;

  const { rect, radii } = paddingBox(b);
  const inside = grow(rect, -Math.max(...radii));

  return b.children.some((child) => {
    const r = reachOf(child);

    return (
      !r ||
      r.x < inside.x - 0.5 ||
      r.y < inside.y - 0.5 ||
      r.x + r.width > inside.x + inside.width + 0.5 ||
      r.y + r.height > inside.y + inside.height + 0.5
    );
  });
};

/** The SVG for a CSS transform: its matrix about its origin. */
export const matrix = ({ matrix: [a, b, c, d, e, f], origin: [x, y] }: Transform): string =>
  `translate(${num(x)} ${num(y)}) matrix(${[a, b, c, d, e, f].map(num).join(" ")}) translate(${num(-x)} ${num(-y)})`;
