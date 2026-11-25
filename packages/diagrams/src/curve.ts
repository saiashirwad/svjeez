import { path, type Vec } from "svjeez";
import type { PathBuilder } from "svjeez/tools";
import type { Point } from "./layout/box.ts";

const LEAD = 6;

const HANDLE = 0.62;

interface Piece {
  readonly from: Point;
  readonly c1: Point;
  readonly c2: Point;
  readonly to: Point;
}

const unit = (a: Point, b: Point): Point => {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;

  return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
};

const along = (p: Point, d: Point, by: number): Point => ({ x: p.x + d.x * by, y: p.y + d.y * by });

const same = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

const round = (value: number): number => Math.round(value * 100) / 100;

export const vec = (p: Point): Vec => [round(p.x), round(p.y)];

export interface Curve {
  readonly geometry: PathBuilder;
  readonly samples: readonly Vec[];
}

export const curve = (points: readonly Point[]): Curve => {
  const n = points.length;

  const length = (i: number) =>
    Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.y - points[i]!.y);

  const dir = (i: number) => unit(points[i]!, points[i + 1]!);

  const reach = (i: number, other: number) =>
    other === 0 || other === n - 1 ? Math.max(0, length(i) - LEAD) : length(i) / 2;

  const pieces: Piece[] = [];

  for (let i = 1; i < n - 1; i++) {
    const [din, dout] = [dir(i - 1), dir(i)];
    const [before, after] = [reach(i - 1, i - 1), reach(i, i + 1)];
    const [a, b] = [along(points[i]!, din, -before), along(points[i]!, dout, after)];

    pieces.push({
      from: a,
      c1: along(points[i]!, din, -before * (1 - HANDLE)),
      c2: along(points[i]!, dout, after * (1 - HANDLE)),
      to: b,
    });
  }

  const at = (p: Piece, t: number): Point => {
    const u = 1 - t;
    const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];

    return {
      x: a * p.from.x + b * p.c1.x + c * p.c2.x + d * p.to.x,
      y: a * p.from.y + b * p.c1.y + c * p.c2.y + d * p.to.y,
    };
  };

  let geometry = path().moveTo(vec(points[0]!));
  let pen = points[0]!;

  for (const p of pieces) {
    if (!same(p.from, pen)) geometry = geometry.lineTo(vec(p.from));
    geometry = geometry.curveTo(vec(p.c1), vec(p.c2), vec(p.to));
    pen = p.to;
  }

  if (!same(points[n - 1]!, pen)) geometry = geometry.lineTo(vec(points[n - 1]!));

  return {
    geometry,
    samples: [
      points[0]!,
      ...pieces.flatMap((p) => Array.from({ length: 9 }, (_, k) => at(p, k / 8))),
      points[n - 1]!,
    ].flatMap((p, k, all) => (k === 0 || !same(p, all[k - 1]!) ? [vec(p)] : [])),
  };
};
