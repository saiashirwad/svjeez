import { alongOutline, contoursOf, lengthOf, outlineBoxOf } from "../model/geometry";
import { lineCubic } from "../model/curve";
import type { Box, Contour, Cubic, Geometry as Outline, Vec } from "../model/ir";
import { SceneError } from "../model/scene-error";
import { outlineOf, type Geometry } from "./values";

export interface AroundOptions {
  readonly about?: Vec;
  readonly offset?: number;
}

export interface PointAt {
  readonly point: Vec;
  readonly angle: number;
}

export interface SplineOptions {
  readonly closed?: boolean;
  readonly tension?: number;
}

const DEG = Math.PI / 180;

const isVec = (value: number | Vec): value is Vec => Array.isArray(value);

const isNumber = (value: "x" | "y" | number): value is number => typeof value === "number";

const isBuilder = (
  shape: Geometry | ((deg: number, index: number) => Geometry),
): shape is (deg: number, index: number) => Geometry => typeof shape === "function";

const finitePoint = (point: Vec, what: string): void => {
  if (!point.every((n) => Number.isFinite(n)))
    throw new SceneError(`${what} needs a finite point, got ${JSON.stringify(point)}.`);
};

const finiteNumber = (value: number, what: string, label: string): void => {
  if (!Number.isFinite(value))
    throw new SceneError(`${what} needs a finite ${label}, got ${value}.`);
};

const transformOutline = (geometry: Geometry, map: (point: Vec) => Vec): Outline => {
  const outline = outlineOf(geometry);

  switch (outline.kind) {
    case "line":
      return { kind: "line", from: map(outline.from), to: map(outline.to) };
    case "points":
      return { kind: "points", points: outline.points.map(map), closed: outline.closed };
    default:
      return {
        kind: "path",
        contours: contoursOf(outline).map((contour) => ({
          start: map(contour.start),
          curves: contour.curves.map(([c1, c2, to]): Cubic => [map(c1), map(c2), map(to)]),
          closed: contour.closed,
        })),
        rule: outline.kind === "path" ? outline.rule : "nonzero",
      };
  }
};

/** Rotates `geometry` clockwise by `deg` degrees around `about` (default `[0, 0]`). */
export const rotated = (geometry: Geometry, deg: number, about: Vec = [0, 0]): Outline => {
  finiteNumber(deg, "rotated()", "angle");
  finitePoint(about, "rotated()");

  const rad = deg * DEG;
  const [cos, sin] = [Math.cos(rad), Math.sin(rad)];
  const [cx, cy] = about;

  return transformOutline(geometry, ([x, y]) => {
    const [dx, dy] = [x - cx, y - cy];

    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
};

/** Scales `geometry` by `factor` (uniform or `[sx, sy]`) around `about` (default `[0, 0]`). */
export const scaled = (geometry: Geometry, factor: number | Vec, about: Vec = [0, 0]): Outline => {
  const [sx, sy] = isVec(factor) ? factor : [factor, factor];

  finiteNumber(sx, "scaled()", "scale");
  finiteNumber(sy, "scaled()", "scale");
  finitePoint(about, "scaled()");

  const [cx, cy] = about;

  return transformOutline(geometry, ([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
};

/**
 * Reflects `geometry` across an axis through `about` (default `[0, 0]`):
 * `"x"` mirrors horizontally across `x = about[0]`, `"y"` mirrors vertically across `y = about[1]`,
 * or a finite angle in degrees reflects across the line at that angle clockwise from +X.
 */
export const mirrored = (
  geometry: Geometry,
  axis: "x" | "y" | number = "x",
  about: Vec = [0, 0],
): Outline => {
  finitePoint(about, "mirrored()");

  const [cx, cy] = about;

  if (axis === "x") return transformOutline(geometry, ([x, y]) => [2 * cx - x, y]);

  if (axis === "y") return transformOutline(geometry, ([x, y]) => [x, 2 * cy - y]);

  if (!isNumber(axis) || !Number.isFinite(axis))
    throw new SceneError(
      `mirrored() takes axis "x", "y" or a finite angle in degrees, got ${String(axis)}.`,
    );

  const rad = 2 * axis * DEG;
  const [cos, sin] = [Math.cos(rad), Math.sin(rad)];

  return transformOutline(geometry, ([x, y]) => {
    const [dx, dy] = [x - cx, y - cy];

    return [cx + dx * cos + dy * sin, cy + dx * sin - dy * cos];
  });
};

/** Combines contours from any number of geometries into one compound path (e.g. for one `draw` track). */
export const merge = (...geometries: readonly Geometry[]): Outline => ({
  kind: "path",
  contours: geometries.flatMap((geometry) => contoursOf(outlineOf(geometry))),
  rule: "nonzero",
});

/** Repeats a geometry (or builder function) evenly `count` times around `about`, merged into one path. */
export const around = (
  count: number,
  shape: Geometry | ((deg: number, index: number) => Geometry),
  { about = [0, 0], offset = 0 }: AroundOptions = {},
): Outline => {
  if (!Number.isInteger(count) || count < 0)
    throw new SceneError(`around() needs a whole count of 0 or more, got ${count}.`);

  finitePoint(about, "around()");
  finiteNumber(offset, "around()", "offset");

  if (count === 0) return { kind: "path", contours: [], rule: "nonzero" };

  const step = 360 / count;

  const copies = Array.from({ length: count }, (_, i) => {
    const deg = offset + step * i;

    return isBuilder(shape) ? shape(deg, i) : rotated(shape, deg, about);
  });

  return merge(...copies);
};

const reverseContour = (contour: Contour): Contour => {
  const { start, curves, closed } = contour;

  if (curves.length === 0) return contour;

  const end = curves.at(-1)![2];
  const reversedCurves: Cubic[] = [];

  for (let i = curves.length - 1; i >= 0; i--) {
    const [c1, c2] = curves[i]!;
    const prev = i === 0 ? start : curves[i - 1]![2];

    reversedCurves.push([c2, c1, prev]);
  }

  return { start: end, curves: reversedCurves, closed };
};

/** Reverses contour direction so `draw` / `trim` traces from the opposite end. */
export const reversed = (geometry: Geometry): Outline => {
  const outline = outlineOf(geometry);

  switch (outline.kind) {
    case "line":
      return { kind: "line", from: outline.to, to: outline.from };
    case "points":
      return {
        kind: "points",
        points: outline.closed
          ? [outline.points[0]!, ...outline.points.slice(1).reverse()]
          : [...outline.points].reverse(),
        closed: outline.closed,
      };
    default:
      return {
        kind: "path",
        contours: contoursOf(outline).map(reverseContour).reverse(),
        rule: outline.kind === "path" ? outline.rule : "nonzero",
      };
  }
};

/** Tight axis-aligned bounding box `{ x, y, width, height }` of any geometry. */
export const bounds = (geometry: Geometry): Box => outlineBoxOf(outlineOf(geometry));

/** Total arc length of any geometry in scene units. */
export const length = (geometry: Geometry): number => lengthOf(outlineOf(geometry));

/** Point and tangent angle (in degrees) at normalized arc-length `t` (0 to 1) along `geometry`. */
export const pointAt = (geometry: Geometry, t: number): PointAt => {
  if (!(t >= 0 && t <= 1 && Number.isFinite(t)))
    throw new SceneError(`pointAt() needs t from 0 to 1, got ${t}.`);

  const outline = outlineOf(geometry);
  const total = lengthOf(outline);
  const heading = alongOutline(outline, t * total);

  return { point: heading.point, angle: heading.angle / DEG };
};

const isClosedOutline = (outline: Outline): boolean => {
  switch (outline.kind) {
    case "rect":
    case "ellipse":
      return true;
    case "arc":
    case "line":
      return false;
    case "points":
      return outline.closed;
    case "path":
      return outline.contours.length > 0 && outline.contours.every((c) => c.closed);
  }
};

/** `count` points spread evenly by arc length along `geometry`. */
export const along = (geometry: Geometry, count: number): Vec[] => {
  if (!Number.isInteger(count) || count < 0)
    throw new SceneError(`along() needs a whole count of 0 or more, got ${count}.`);

  if (count === 0) return [];

  const outline = outlineOf(geometry);
  const closed = isClosedOutline(outline);
  const total = lengthOf(outline);

  if (count === 1) return [alongOutline(outline, closed ? 0 : total * 0.5).point];

  const denom = closed ? count : count - 1;

  return Array.from({ length: count }, (_, i) => alongOutline(outline, (i / denom) * total).point);
};

/** Smooth Catmull–Rom cubic spline passing through `points`. */
export const spline = (
  points: readonly Vec[],
  { closed = false, tension = 0.5 }: SplineOptions = {},
): Outline => {
  if (points.length < 2)
    throw new SceneError(`spline() needs two points or more, got ${points.length}.`);

  finiteNumber(tension, "spline()", "tension");

  for (const point of points) finitePoint(point, "spline()");

  const n = points.length;

  if (n === 2) {
    const [a, b] = [points[0]!, points[1]!];

    return {
      kind: "path",
      contours: [
        {
          start: a,
          curves: closed ? [lineCubic(a, b), lineCubic(b, a)] : [lineCubic(a, b)],
          closed,
        },
      ],
      rule: "nonzero",
    };
  }

  const at = (i: number): Vec =>
    closed ? points[((i % n) + n) % n]! : points[Math.max(0, Math.min(n - 1, i))]!;

  const scale = tension / 3;
  const count = closed ? n : n - 1;

  const curves = Array.from({ length: count }, (_, i): Cubic => {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];

    return [
      [p1[0] + (p2[0] - p0[0]) * scale, p1[1] + (p2[1] - p0[1]) * scale],
      [p2[0] - (p3[0] - p1[0]) * scale, p2[1] - (p3[1] - p1[1]) * scale],
      p2,
    ];
  });

  return { kind: "path", contours: [{ start: points[0]!, curves, closed }], rule: "nonzero" };
};
