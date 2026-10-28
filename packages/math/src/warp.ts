import {
  el,
  motion,
  type Motion,
  type Point,
  sampledPath,
  type Color,
  type Ease,
  type PathData,
  type SvgNode,
} from "svjeez";
import { round } from "./matrix.ts";

export type Vec2 = readonly [x: number, y: number];

/** Where every point of the plane sits after some steps, in scene pixels. */
export type Placement = (p: Vec2) => Vec2;

/** One move of the plane: from the previous placement to `place` during `at`…`at + over`. */
export interface Move {
  readonly place: Placement;
  readonly at: number;
  readonly over: number;
  readonly ease: Ease;
}

/** The share of a transition done at `u` of its time, as CSS and SMIL compute it. */
const progress = (e: Ease, u: number): number => {
  if (e.kind === "linear") return u;

  if (e.kind === "steps") return Math.floor(u * e.count) / e.count;
  const [x1, y1, x2, y2] = e.points;

  const curve = (a: number, b: number, s: number) =>
    3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;

  let [lo, hi] = [0, 1];

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;

    if (curve(x1, x2, mid) < u) lo = mid;
    else hi = mid;
  }

  return curve(y1, y2, (lo + hi) / 2);
};

const lerp = (a: Vec2, b: Vec2, u: number): Vec2 => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

/** Which placements a time falls between, and how far: before the first move, `[0, 0, 0]`. */
const phase = (moves: readonly Move[], t: number): readonly [number, number, number] => {
  let done = 0;

  for (const [i, m] of moves.entries()) {
    if (t >= m.at + m.over) done = i + 1;
    else if (t > m.at) return [i, i + 1, progress(m.ease, (t - m.at) / m.over)];
  }

  return [done, done, 0];
};

const TOLERANCE = 0.5;

/** A label sits off its arrow's line, turned this far counterclockwise from straight ahead. */
export const LEAN = (35 * Math.PI) / 180;

/**
 * The points of the segment a→b that every placement needs so its image reads as a smooth curve: a midpoint
 * stays only where some placement bends the segment more than the tolerance from a straight chord.
 */
const refine = (a: Vec2, b: Vec2, places: readonly Placement[], spacing: number): Vec2[] => {
  const pieces = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
  const out: Vec2[] = [a];

  const split = (p: Vec2, q: Vec2, depth: number): void => {
    const mid = lerp(p, q, 0.5);

    const bent = places.some((place) => {
      const [m, chord] = [place(mid), lerp(place(p), place(q), 0.5)];

      return Math.hypot(m[0] - chord[0], m[1] - chord[1]) > TOLERANCE;
    });

    if (bent && depth < 8) {
      split(p, mid, depth + 1);
      split(mid, q, depth + 1);
    } else out.push(q);
  };

  for (let i = 0; i < pieces; i++) split(lerp(a, b, i / pieces), lerp(a, b, (i + 1) / pieces), 0);

  return out;
};

const tenth = (n: number) => Math.round(n * 10) / 10 + 0;

const write = (rings: readonly (readonly Vec2[])[], closed: boolean): PathData =>
  // SAFETY: every ring starts with M, so the text is path data.
  rings
    .map(
      (ring) => `M${ring.map(([x, y]) => `${tenth(x)} ${tenth(y)}`).join(" ")}${closed ? "Z" : ""}`,
    )
    .join("") as PathData;

/** Draws a plane whose moves include a function: every outline is sampled, and each move is one `d` key. */
export interface Warp {
  /** Polylines in plane units, each edge refined so its images stay smooth. */
  rings(polylines: readonly (readonly Vec2[])[], closed: boolean): Vec2[][];
  /** A path whose `d` follows the rings through every move. */
  path(rings: readonly (readonly Vec2[])[], closed: boolean, attrs: PathAttrs): SvgNode;
  /** An arrowhead at the end of `shaft`, upright at every frame. */
  head(shaft: readonly Vec2[], polygon: readonly Vec2[], fill: Color): SvgNode;
  /** `content` riding a point, pushed `push` pixels along `direction` as the plane moves it. */
  ride(point: Vec2, direction: Vec2, push: number, content: SvgNode): SvgNode;
}

export type PathAttrs = {
  readonly fill?: Color | "none";
  readonly fillOpacity?: number;
  readonly stroke?: Color;
  readonly strokeWidth?: number;
  readonly strokeOpacity?: number;
};

export function warp(start: Placement, moves: readonly Move[], spacing: number): Warp {
  const places = [start, ...moves.map((m) => m.place)];

  const morph = (ds: readonly PathData[]): Motion<"d"> =>
    moves.reduce(
      (m, step, i) => m.at(step.at).to({ d: ds[i + 1]! }, step.over, step.ease),
      motion({ d: ds[0]! }),
    );

  const travel = (spots: readonly Point[]): Motion<"x" | "y"> =>
    moves.reduce(
      (m, step, i) => m.at(step.at).to(spots[i + 1]!, step.over, step.ease),
      motion({ x: spots[0]!.x, y: spots[0]!.y }),
    );

  const rings = (polylines: readonly (readonly Vec2[])[], closed: boolean) =>
    polylines.map((line) => {
      const ends = closed ? [...line, line[0]!] : line;

      const points = ends
        .slice(1)
        .flatMap((b, i) => refine(ends[i]!, b, places, spacing).slice(i === 0 ? 0 : 1));

      return closed ? points.slice(0, -1) : points;
    });

  const frames = (ring: readonly (readonly Vec2[])[]) =>
    places.map((place) => ring.map((line) => line.map(place)));

  return {
    rings,
    path(lines, closed, attrs) {
      const ds = frames(lines).map((f) => write(f, closed));

      return el.path({
        ...attrs,
        d: ds[0]!,
        animation: moves.length > 0 ? morph(ds) : undefined,
      });
    },
    head(shaft, polygon, fill) {
      const [tips, backs] = [shaft.at(-1)!, shaft.at(-2)!].map((p) => places.map((f) => f(p)));

      const at = (tip: Vec2, back: Vec2): PathData => {
        const angle = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
        const [c, s] = [Math.cos(angle), Math.sin(angle)];

        return write(
          [polygon.map(([x, y]) => [tip[0] + c * x - s * y, tip[1] + s * x + c * y])],
          true,
        );
      };

      const end = moves.at(-1);

      const d = (t: number) => {
        const [i, j, u] = phase(moves, t);

        return at(lerp(tips![i]!, tips![j]!, u), lerp(backs![i]!, backs![j]!, u));
      };

      return el.path({
        d: d(0),
        fill,
        animation: end
          ? sampledPath(d, { duration: end.at + end.over, tolerance: 0.25 })
          : undefined,
      });
    },
    ride(point, direction, push, content) {
      const step = 1e-3;
      const back: Vec2 = [point[0] - direction[0] * step, point[1] - direction[1] * step];

      const spots = places.map((place) => {
        const [p, q] = [place(point), place(back)];
        const turn = Math.atan2(p[1] - q[1], p[0] - q[0]) - LEAN;

        return { x: round(p[0] + push * Math.cos(turn)), y: round(p[1] + push * Math.sin(turn)) };
      });

      return el.g({ animation: travel(spots) }, content);
    },
  };
}
