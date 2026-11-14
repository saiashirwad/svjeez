import { num } from "./format";
import type { Point } from "./layout/box";
import type { PathData } from "./paths";

export type { Point };

/** The total length of the straight runs between consecutive points. */
export const pathLength = (points: readonly Point[]): number =>
  points
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y), 0);

/** `count` points evenly spaced along the straight runs between `points`, from the first point to the last. */
export const resample = (points: readonly Point[], count: number): Point[] => {
  if (points.length < 2)
    throw new Error(`resample() needs at least two points, got ${points.length}.`);

  if (!Number.isInteger(count) || count < 2)
    throw new Error(`resample() needs a whole count of 2 or more, got ${count}.`);
  const along = [0];

  for (let i = 1; i < points.length; i++)
    along.push(
      along[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y),
    );
  const total = along.at(-1)!;
  let j = 1;

  return Array.from({ length: count }, (_, i) => {
    const d = (total * i) / (count - 1);

    while (j < points.length - 1 && along[j]! < d) j++;
    const [a, b] = [points[j - 1]!, points[j]!];
    const u = Math.min(1, Math.max(0, (d - along[j - 1]!) / (along[j]! - along[j - 1]! || 1)));

    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  });
};

export interface PolylinePathOptions {
  /** Close the shape back to the first point. Default false. */
  readonly closed?: boolean;
  /** Decimal places in the output. Default 1. */
  readonly precision?: number;
}

/** Path data for the straight runs between `points`: `M` to the first, `L` to each after. */
export const polylinePath = (
  points: readonly Point[],
  { closed = false, precision = 1 }: PolylinePathOptions = {},
): PathData => {
  if (points.length === 0) throw new Error("polylinePath() needs at least one point.");
  const d = points.map((p, i) => `${i ? "L" : "M"}${num(p.x, precision)} ${num(p.y, precision)}`);

  // SAFETY: the first command is always M, so the text is path data.
  return `${d.join("")}${closed ? "Z" : ""}` as PathData;
};

export type Edge = "top" | "right" | "bottom" | "left";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly top: Point;
  readonly right: Point;
  readonly bottom: Point;
  readonly left: Point;
  readonly center: Point;
  pad(n: number): Rect;
  union(other: Rect): Rect;
  /** The point `t` of the way along `edge`, left to right or top to bottom. */
  side(edge: Edge, t: number): Point;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({
  x,
  y,
  w,
  h,
  top: { x: x + w / 2, y },
  right: { x: x + w, y: y + h / 2 },
  bottom: { x: x + w / 2, y: y + h },
  left: { x, y: y + h / 2 },
  center: { x: x + w / 2, y: y + h / 2 },
  pad: (n) => rect(x - n, y - n, w + n * 2, h + n * 2),
  union: (o) => {
    const [left, top] = [Math.min(x, o.x), Math.min(y, o.y)];

    return rect(left, top, Math.max(x + w, o.x + o.w) - left, Math.max(y + h, o.y + o.h) - top);
  },
  side: (edge, t) =>
    edge === "top" || edge === "bottom"
      ? { x: x + w * t, y: edge === "top" ? y : y + h }
      : { x: edge === "left" ? x : x + w, y: y + h * t },
});
