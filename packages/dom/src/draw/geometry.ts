import { type PathData } from "svjeez";
import { num } from "svjeez/geometry";
import type {
  Box,
  Gradient,
  Item,
  Placement,
  Radii,
  Rect,
  TextRun,
  Transform,
  Vector,
} from "../tree.ts";

type Sides = readonly [top: number, right: number, bottom: number, left: number];

/**
 * A rounded rectangle with a radius per corner. A sharp one is four lines, a third the size; `morphable` gives two
 * outlines the same commands so they tween, writing a sharp one's corners as arcs of radius 0 when the other has arcs.
 */
export const rounded = ({ x, y, width: w, height: h }: Rect, [tl, tr, br, bl]: Radii): PathData => {
  if (tl === 0 && tr === 0 && br === 0 && bl === 0)
    return `M${num(x)} ${num(y)}H${num(x + w)}V${num(y + h)}H${num(x)}Z`;

  const arc = (r: number, ex: number, ey: number) =>
    `A${num(r)} ${num(r)} 0 0 1 ${num(ex)} ${num(ey)}`;

  return `M${num(x + tl)} ${num(y)}H${num(x + w - tr)}${arc(tr, x + w, y + tr)}V${num(y + h - br)}${arc(br, x + w - br, y + h)}H${num(x + bl)}${arc(bl, x, y + h - bl)}V${num(y + tl)}${arc(tl, x + tl, y)}Z`;
};

const SHARP = /M(-?[\d.]+) (-?[\d.]+)H(-?[\d.]+)V(-?[\d.]+)H(-?[\d.]+)Z/g;

/** The commands of a path, which two paths must share to tween. */
export const commands = (d: string): string => d.replace(/[^A-Za-z]/g, "");

/** Every sharp rectangle in `d` with its corners as arcs of radius 0, the way `rounded` draws a round one. */
const arced = (d: PathData): PathData =>
  // SAFETY: the replacement is a path again, the same rectangle in other commands.
  (d as string).replace(SHARP, (_, x: string, y: string, r: string, b: string) => {
    const arc = (ex: string, ey: string) => `A0 0 0 0 1 ${ex} ${ey}`;

    return `M${x} ${y}H${r}${arc(r, y)}V${b}${arc(r, b)}H${x}${arc(x, b)}V${y}${arc(x, y)}Z`;
  }) as PathData;

/** Two outlines with the same commands, so one tweens into the other: sharp corners become arcs where needed. */
export const morphable = (a: PathData, b: PathData): [PathData, PathData] =>
  commands(a) === commands(b) ? [a, b] : [arced(a), arced(b)];

/** Shifts by `(dx, dy)`, to the hundredth, as the snapshot writes positions, so a shifted copy compares equal. */
interface Shift {
  readonly x: (n: number) => number;
  readonly y: (n: number) => number;
}

const shiftBy = (dx: number, dy: number): Shift => ({
  x: (n) => Math.round((n + dx) * 100) / 100,
  y: (n) => Math.round((n + dy) * 100) / 100,
});

const movedRect = (r: Rect, s: Shift): Rect => ({ ...r, x: s.x(r.x), y: s.y(r.y) });

const movedTransform = (t: Transform | undefined, s: Shift): Transform | undefined =>
  t && { ...t, origin: [s.x(t.origin[0]), s.y(t.origin[1])] };

const movedRun = (r: TextRun, s: Shift): TextRun => ({ ...r, x: s.x(r.x), y: s.y(r.y) });

// A graphic's own attributes are in its viewBox, which moves with its box; only a mask's text is in the page's.
const movedVector = (v: Vector, s: Shift): Vector => ({
  ...v,
  children: v.children.map((c) => movedVector(c, s)),
  mask: v.mask?.map((c) => movedVector(c, s)),
  run: v.run && movedRun(v.run, s),
});

const movedGradient = (g: Gradient, s: Shift): Gradient =>
  g.kind === "linear"
    ? { ...g, x1: s.x(g.x1), y1: s.y(g.y1), x2: s.x(g.x2), y2: s.y(g.y2) }
    : { ...g, cx: s.x(g.cx), cy: s.y(g.cy) };

const movedPlacement = (p: Placement, s: Shift): Placement => ({
  ...p,
  tiles: p.tiles.map((r) => movedRect(r, s)),
});

/** An item moved: every position in it, in the page's coordinates. Shadows are offsets, so they stay. */
const moved = (it: Item, s: Shift): Item => {
  switch (it.kind) {
    case "text":
      return movedRun(it, s);
    case "graphic":
      return {
        ...it,
        box: movedRect(it.box, s),
        transform: movedTransform(it.transform, s),
        children: it.children.map((c) => movedVector(c, s)),
      };
    case "image":
      return {
        ...it,
        box: movedRect(it.box, s),
        fit: it.fit && movedRect(it.fit, s),
        transform: movedTransform(it.transform, s),
      };
    case "box":
      return {
        ...it,
        box: movedRect(it.box, s),
        transform: movedTransform(it.transform, s),
        gradients: it.gradients?.map((g) => movedGradient(g, s)),
        pictures: it.pictures?.map((p) => movedPlacement(p, s)),
        mask: it.mask?.map((p) => movedPlacement(p, s)),
        children: it.children.map((c) => moved(c, s)),
      };
  }
};

/** `b` moved by `(dx, dy)`: every position in it, to the hundredth as the snapshot writes them. */
export const shifted = (b: Box, dx: number, dy: number): Box => {
  const out = moved(b, shiftBy(dx, dy));

  // SAFETY: `moved` keeps an item's kind, and `b` is a box.
  return out as Box;
};

/** How far `b` lies from `a` when it is `a` moved and nothing else, or undefined. */
export const offset = (a: Box, b: Box): { dx: number; dy: number } | undefined => {
  const dx = b.box.x - a.box.x;
  const dy = b.box.y - a.box.y;

  if (dx === 0 && dy === 0) return undefined;

  return JSON.stringify(moved(a, shiftBy(dx, dy))) === JSON.stringify(moved(b, shiftBy(0, 0)))
    ? { dx, dy }
    : undefined;
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

/** An outline: the ring `width` thick that starts `offset` outside the border box, with the corners grown to match. */
export const outlineRing = (b: Box): PathData => {
  const o = b.outline;

  // Without one, a ring of nothing, so it can grow from or fade into another box's.
  if (!o) return `${rounded(b.box, b.radii)}${rounded(b.box, b.radii)}`;

  return `${rounded(grow(b.box, o.offset + o.width), growRadii(b.radii, o.offset + o.width))}${rounded(grow(b.box, o.offset), growRadii(b.radii, o.offset))}`;
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
  `translate(${num(x)} ${num(y)}) matrix(${[a, b, c, d, e, f].map((n) => num(n)).join(" ")}) translate(${num(-x)} ${num(-y)})`;
