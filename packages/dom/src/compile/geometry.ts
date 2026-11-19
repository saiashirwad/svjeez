import { path, rect, type Geometry } from "svjeez";
import type { Corner, Rect } from "../schema.ts";

export type Vec = readonly [x: number, y: number];

export type Radii = readonly [Corner, Corner, Corner, Corner];

const NONE: Radii = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
];

/** Far enough out that a clip this large cuts nothing. */
export const BIG = 1e5;

/** How a circle's quarter is drawn as one cubic. */
const KAPPA = 0.5522847498;

export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];

export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];

export const at = (box: Rect): Vec => [box.x, box.y];

const grow = (box: Rect, by: number): Rect => ({
  x: box.x - by,
  y: box.y - by,
  width: box.width + by * 2,
  height: box.height + by * 2,
});

/** The box with each side pulled in by its own amount: [top, right, bottom, left]. */
export const inset = (box: Rect, [top, right, bottom, left]: Sides): Rect => ({
  x: box.x + left,
  y: box.y + top,
  width: box.width - left - right,
  height: box.height - top - bottom,
});

const corners = (radii: Radii, change: (corner: Corner) => Corner): Radii => {
  const [tl, tr, br, bl] = radii;

  return [change(tl), change(tr), change(br), change(bl)];
};

/** A box and its corners moved out by `by` (or in, when negative). A square corner stays square. */
export const expand = (box: Rect, radii: Radii | undefined, by: number) => ({
  box: grow(box, by),
  radii:
    radii &&
    corners(radii, ([x, y]) => [x > 0 ? Math.max(0, x + by) : 0, y > 0 ? Math.max(0, y + by) : 0]),
});

/** Border widths as [top, right, bottom, left]. */
export type Sides = readonly [number, number, number, number];

/** Radii of a box whose sides were pulled in by `sides`. */
export const innerRadii = (
  radii: Radii | undefined,
  [top, right, bottom, left]: Sides,
): Radii | undefined => {
  if (!radii) return undefined;

  const [tl, tr, br, bl] = radii;

  return [
    [Math.max(0, tl[0] - left), Math.max(0, tl[1] - top)],
    [Math.max(0, tr[0] - right), Math.max(0, tr[1] - top)],
    [Math.max(0, br[0] - right), Math.max(0, br[1] - bottom)],
    [Math.max(0, bl[0] - left), Math.max(0, bl[1] - bottom)],
  ];
};

const circular = (radii: Radii): boolean => radii.every(([x, y]) => Math.abs(x - y) < 0.01);

/** The box as a rounded rect, with its corners clamped so they never overlap. */
const clamped = (box: Rect, radii: Radii): Radii => {
  const side = (a: number, b: number, length: number) => (a + b > length ? length / (a + b) : 1);

  const f = Math.min(
    1,
    side(radii[0][0], radii[1][0], box.width),
    side(radii[3][0], radii[2][0], box.width),
    side(radii[0][1], radii[3][1], box.height),
    side(radii[1][1], radii[2][1], box.height),
  );

  return corners(radii, ([x, y]) => [x * f, y * f]);
};

/** The box as an outline in its own coordinates, corners and all. */
export const outline = (box: Rect, radii: Radii = NONE) => {
  const [tl, tr, br, bl] = clamped(box, radii);
  const { x, y, width: w, height: h } = box;
  const k = KAPPA;

  return path()
    .moveTo([x + tl[0], y])
    .lineTo([x + w - tr[0], y])
    .curveTo([x + w - tr[0] + k * tr[0], y], [x + w, y + tr[1] - k * tr[1]], [x + w, y + tr[1]])
    .lineTo([x + w, y + h - br[1]])
    .curveTo(
      [x + w, y + h - br[1] + k * br[1]],
      [x + w - br[0] + k * br[0], y + h],
      [x + w - br[0], y + h],
    )
    .lineTo([x + bl[0], y + h])
    .curveTo([x + bl[0] - k * bl[0], y + h], [x, y + h - bl[1] + k * bl[1]], [x, y + h - bl[1]])
    .lineTo([x, y + tl[1]])
    .curveTo([x, y + tl[1] - k * tl[1]], [x + tl[0] - k * tl[0], y], [x + tl[0], y])
    .close();
};

/** What a shape needs to draw `box`: its geometry, and where `at` puts it. */
export interface Placed {
  readonly geometry: Geometry;
  readonly at?: Vec;
}

/**
 * The box as a shape with core's own `rect()` when its corners are round, else a path.
 * `stroke` is the width of a centered stroke: `at` puts the painted box, so it backs off by half of it.
 */
export const rounded = (box: Rect, radii: Radii | undefined, stroke = 0): Placed => {
  if (radii && !circular(radii)) return { geometry: outline(box, radii) };

  return {
    geometry: rect(Math.max(0, box.width), Math.max(0, box.height), {
      ...(radii && { radius: [radii[0][0], radii[1][0], radii[2][0], radii[3][0]] }),
    }),
    at: [box.x - stroke / 2, box.y - stroke / 2],
  };
};

/** A closed outline with `inner` cut out of `outer`, whichever way the two are drawn. */
export const ring = (
  outer: ReturnType<typeof outline>,
  inner?: ReturnType<typeof outline>,
): Geometry =>
  inner
    ? { kind: "path", contours: [...outer.contours, ...inner.contours], rule: "evenodd" }
    : outer;
