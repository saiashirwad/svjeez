import type { Point } from "../../geometry";
import { BEND } from "../../layout/layered";

const CORNER = 10;

/** Cubic control distance that makes a quarter circle. */
const ROUND = 0.55;

type Piece = { readonly from: Point; readonly c1: Point; readonly c2: Point; readonly to: Point };

const unit = (a: Point, b: Point): Point => {
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;

  return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
};

const along = (p: Point, d: Point, by: number): Point => ({ x: p.x + d.x * by, y: p.y + d.y * by });
const same = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

/**
 * Smooths an orthogonal polyline. A jog (down, across, down) becomes one S-curve whose ends leave and arrive
 * straight; any other corner is rounded. Straight runs keep their direction, so the ends stay square to the borders.
 */
export interface Curve {
  readonly d: string;
  readonly samples: Point[];
}

export const curve = (points: readonly Point[]): Curve => {
  const n = points.length;

  const length = (i: number) =>
    Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.y - points[i]!.y);

  const dir = (i: number) => unit(points[i]!, points[i + 1]!);
  /** How much of segment `i` a curve at one end may take: half if another curve takes the other end. */
  const budget = (i: number) => (i === 0 || i === n - 2 ? length(i) - 2 : length(i) / 2);
  const pieces: Piece[] = [];

  for (let i = 1; i < n - 1; i++) {
    const [din, dmid] = [dir(i - 1), dir(i)];
    const dout = i + 1 < n - 1 ? dir(i + 1) : undefined;

    if (dout && same(din, dout) && !same(din, dmid)) {
      const [s1, s2] = [Math.min(BEND, budget(i - 1)), Math.min(BEND, budget(i + 1))];
      pieces.push({
        from: along(points[i]!, din, -s1),
        c1: points[i]!,
        c2: points[i + 1]!,
        to: along(points[i + 1]!, dout, s2),
      });
      i++;
      continue;
    }

    const r = Math.max(0, Math.min(CORNER, budget(i - 1), budget(i)));
    const [a, b] = [along(points[i]!, din, -r), along(points[i]!, dmid, r)];
    pieces.push({ from: a, c1: along(a, din, r * ROUND), c2: along(b, dmid, -r * ROUND), to: b });
  }

  const at = (p: Piece, t: number): Point => {
    const u = 1 - t;
    const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];

    return {
      x: a * p.from.x + b * p.c1.x + c * p.c2.x + d * p.to.x,
      y: a * p.from.y + b * p.c1.y + c * p.c2.y + d * p.to.y,
    };
  };

  const f = (p: Point) => `${+p.x.toFixed(2)} ${+p.y.toFixed(2)}`;

  return {
    d: `M${f(points[0]!)}${pieces.map((p) => `L${f(p.from)}C${f(p.c1)} ${f(p.c2)} ${f(p.to)}`).join("")}L${f(points[n - 1]!)}`,
    samples: [
      points[0]!,
      ...pieces.flatMap((p) => Array.from({ length: 9 }, (_, k) => at(p, k / 8))),
      points[n - 1]!,
    ].filter((p, k, all) => k === 0 || !same(p, all[k - 1]!)),
  };
};
