import { num } from "./format";
import type { Point } from "./layout/box";

/**
 * A smooth curve through points. A position on it runs from 0 at the first point to `legs` at the last, and leg `i`
 * spans `i` to `i + 1`, so `i + u` is `u` of the way along leg `i` by its own parameter.
 */
export interface Spline {
  /** Path data for the whole curve, one cubic Bézier per leg. */
  readonly d: string;
  /** How many legs: one fewer than the points. */
  readonly legs: number;
  point(at: number): Point;
  /** How the point moves per unit of position at `at`: its direction is the way of travel, its length the speed. */
  tangent(at: number): Point;
  /** The direction of travel at `at`, in degrees as `rotate` takes them: 0 along +x, 90 along +y. */
  angle(at: number): number;
  /** Path data from `from` to `to`, cut exactly from the legs it crosses. */
  path(from?: number, to?: number): string;
  /** The position between `from` and `to` closest to `p`. */
  nearest(p: Point, from?: number, to?: number): number;
}

type Cubic = readonly [Point, Point, Point, Point];

const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** The part of a cubic between parameters `u0` and `u1`, by de Casteljau. */
const cut = ([a, b, c, d]: Cubic, u0: number, u1: number): Cubic => {
  const left = (q: Cubic, t: number): Cubic => {
    const ab = mix(q[0], q[1], t);
    const bc = mix(q[1], q[2], t);
    const abc = mix(ab, bc, t);
    const bcd = mix(bc, mix(q[2], q[3], t), t);

    return [q[0], ab, abc, mix(abc, bcd, t)];
  };

  const head = left([a, b, c, d], u1);

  if (u0 <= 0) return head;
  const reversed = left([head[3], head[2], head[1], head[0]], 1 - u0 / u1);

  return [reversed[3], reversed[2], reversed[1], reversed[0]];
};

const at = (p: Point) => `${num(p.x, 2)} ${num(p.y, 2)}`;

/**
 * A curve through every point, in order: a uniform Catmull-Rom spline written as cubic Béziers, with each end leaving
 * toward its neighbor. Use it to fly something along a smooth route: `point` and `angle` feed `sampled()`, and `d`
 * draws the route.
 */
export const spline = (points: readonly Point[]): Spline => {
  if (points.length < 2)
    throw new Error(`spline() needs at least two points, got ${points.length}.`);

  const legs = points.length - 1;
  const pick = (i: number) => points[Math.max(0, Math.min(legs, i))]!;

  const cubics = Array.from({ length: legs }, (_, i): Cubic => {
    const [p0, p1, p2, p3] = [pick(i - 1), pick(i), pick(i + 1), pick(i + 2)];

    return [
      p1,
      { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p2,
    ];
  });

  const clamp = (position: number) => Math.max(0, Math.min(legs, position));

  /** The leg a position falls on, and how far along it. The last point belongs to the last leg. */
  const locate = (position: number) => {
    const leg = Math.min(legs - 1, Math.floor(clamp(position)));

    return { cubic: cubics[leg]!, u: clamp(position) - leg };
  };

  const point = (position: number): Point => {
    const { cubic, u } = locate(position);
    const v = 1 - u;
    const [w0, w1, w2, w3] = [v * v * v, 3 * v * v * u, 3 * v * u * u, u * u * u];

    return {
      x: w0 * cubic[0].x + w1 * cubic[1].x + w2 * cubic[2].x + w3 * cubic[3].x,
      y: w0 * cubic[0].y + w1 * cubic[1].y + w2 * cubic[2].y + w3 * cubic[3].y,
    };
  };

  const tangent = (position: number): Point => {
    const {
      cubic: [a, b, c, d],
      u,
    } = locate(position);

    const v = 1 - u;
    const [w0, w1, w2] = [3 * v * v, 6 * v * u, 3 * u * u];

    return {
      x: w0 * (b.x - a.x) + w1 * (c.x - b.x) + w2 * (d.x - c.x),
      y: w0 * (b.y - a.y) + w1 * (c.y - b.y) + w2 * (d.y - c.y),
    };
  };

  const angle = (position: number): number => {
    const { x, y } = tangent(position);

    return (Math.atan2(y, x) * 180) / Math.PI;
  };

  const path = (from = 0, to = legs): string => {
    const [start, end] = [clamp(Math.min(from, to)), clamp(Math.max(from, to))];
    let d = `M${at(point(start))}`;

    for (let leg = Math.floor(start); leg < Math.min(legs, Math.ceil(end)); leg++) {
      const u0 = Math.max(0, start - leg);
      const u1 = Math.min(1, end - leg);

      if (u1 <= u0) continue;
      const [, b, c, e] = cut(cubics[leg]!, u0, u1);
      d += `C${at(b)} ${at(c)} ${at(e)}`;
    }

    return d;
  };

  const nearest = (p: Point, from = 0, to = legs): number => {
    const [start, end] = [clamp(Math.min(from, to)), clamp(Math.max(from, to))];

    const distance = (position: number) => {
      const q = point(position);

      return (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    };

    const steps = Math.max(1, Math.ceil((end - start) * 32));
    let best = start;

    for (let k = 0; k <= steps; k++) {
      const position = start + ((end - start) * k) / steps;

      if (distance(position) < distance(best)) best = position;
    }

    let [lo, hi] = [
      Math.max(start, best - (end - start) / steps),
      Math.min(end, best + (end - start) / steps),
    ];

    for (let k = 0; k < 40; k++) {
      const [m1, m2] = [lo + (hi - lo) / 3, hi - (hi - lo) / 3];

      if (distance(m1) < distance(m2)) hi = m2;
      else lo = m1;
    }

    return (lo + hi) / 2;
  };

  return { d: path(), legs, point, tangent, angle, path, nearest };
};
