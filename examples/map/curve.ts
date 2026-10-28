import type { Point } from "svjeez";
import { n } from "./kit";

type Cubic = readonly [Point, Point, Point, Point];

/** A Catmull-Rom spline through the points, as cubic Béziers. */
const cubics = (pts: readonly Point[], closed: boolean): Cubic[] => {
  const at = (i: number) =>
    pts[closed ? (i + pts.length) % pts.length : Math.max(0, Math.min(pts.length - 1, i))]!;

  return Array.from({ length: closed ? pts.length : pts.length - 1 }, (_, i) => {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];

    return [
      p1,
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ];
  });
};

/** Points from a flat list: `pts([x0, y0, x1, y1])`. */
export const pts = (xy: number[]): Point[] =>
  Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[i * 2]!, y: xy[i * 2 + 1]! }));

export const smooth = (pts: readonly Point[], closed = false): string => {
  const curves = cubics(pts, closed).map(
    ([, a, b, p]) => `C${n(a.x)} ${n(a.y)} ${n(b.x)} ${n(b.y)} ${n(p.x)} ${n(p.y)}`,
  );

  return `M${n(pts[0]!.x)} ${n(pts[0]!.y)}${curves.join("")}${closed ? "Z" : ""}`;
};

export interface Trace {
  readonly pts: Point[];
  /** Arc length at each point. */
  readonly len: number[];
  readonly total: number;
  /** The point `s` px along, with the heading there in degrees. */
  at(s: number): Point & { readonly angle: number };
}

/** The open spline through `points`, sampled `steps` times per span, with lengths. */
export const trace = (points: readonly Point[], steps = 16): Trace => {
  const pts = [points[0]!];

  for (const [p0, p1, p2, p3] of cubics(points, false)) {
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      pts.push({
        x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
        y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
      });
    }
  }

  const len = [0];

  for (let i = 1; i < pts.length; i++)
    len.push(len[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));

  const at = (s: number) => {
    const k = Math.max(
      1,
      len.findIndex((l) => l >= s),
    );

    const [a, b] = [pts[k - 1]!, pts[k]!];
    const t = (s - len[k - 1]!) / (len[k]! - len[k - 1]! || 1);

    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    };
  };

  return { pts, len, total: len.at(-1)!, at };
};
