import type { Box, Cubic, Geometry, ShapeNode, Stroke, Vec } from "./ir";
import { atRest } from "./lane";
import { boxOf, onCircle } from "../author/values";

export const MITER_LIMIT = 4;

export interface StrokeLook {
  readonly width: number;
  readonly cap: Stroke["cap"];
  readonly join: Stroke["join"];
  readonly cut: boolean;
}

const EPS = 1e-9;

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const times = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1];
const cross = (a: Vec, b: Vec): number => a[0] * b[1] - a[1] * b[0];

const unit = (v: Vec): Vec | undefined => {
  const length = Math.hypot(v[0], v[1]);

  return length > EPS ? [v[0] / length, v[1] / length] : undefined;
};

const normal = ([x, y]: Vec): Vec => [-y, x];

const around = (points: readonly Vec[]): Box => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const grown = ({ x, y, width, height }: Box, by: number): Box => ({
  x: x - by,
  y: y - by,
  width: width + by * 2,
  height: height + by * 2,
});

const corners = ({ x, y, width, height }: Box): Vec[] => [
  [x, y],
  [x + width, y + height],
];

interface Segment {
  readonly from: Vec;
  readonly curve: Cubic;
}

const tangents = ({ from, curve: [c1, c2, to] }: Segment): readonly [Vec, Vec] | undefined => {
  const start = unit(sub(c1, from)) ?? unit(sub(c2, from)) ?? unit(sub(to, from));
  const end = unit(sub(to, c2)) ?? unit(sub(to, c1)) ?? unit(sub(to, from));

  return start && end ? [start, end] : undefined;
};

const isStraight = ({ from, curve: [c1, c2, to] }: Segment): boolean => {
  const way = sub(to, from);
  const length = Math.hypot(way[0], way[1]);

  return (
    length > EPS &&
    Math.abs(cross(way, sub(c1, from))) <= 1e-9 * length * length &&
    Math.abs(cross(way, sub(c2, from))) <= 1e-9 * length * length
  );
};

const pointOn = ({ from, curve: [c1, c2, to] }: Segment, t: number): Vec => {
  const s = 1 - t;
  const [a, b, c, d] = [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];

  return [
    a * from[0] + b * c1[0] + c * c2[0] + d * to[0],
    a * from[1] + b * c1[1] + c * c2[1] + d * to[1],
  ];
};

const turning = (a: number, b: number, c: number, d: number): number[] => {
  const [p, q, r] = [-a + 3 * b - 3 * c + d, 2 * (a - 2 * b + c), -a + b];

  if (Math.abs(p) < 1e-12) return Math.abs(q) < 1e-12 ? [] : [-r / q];
  const disc = q * q - 4 * p * r;

  if (disc < 0) return [];

  return [1, -1].map((sign) => (-q + sign * Math.sqrt(disc)) / (2 * p));
};

const arcReach = (center: Vec, h: number, from: Vec, sweep: number): Vec[] => {
  const start = Math.atan2(from[1], from[0]);
  const out: Vec[] = [add(center, times(from, h))];

  if (Math.abs(sweep) <= EPS) return out;

  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2;

    const turned =
      ((((angle - start) * Math.sign(sweep)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    if (turned <= Math.abs(sweep) + EPS)
      out.push(add(center, [h * Math.cos(angle), h * Math.sin(angle)]));
  }

  return out;
};

interface Run {
  readonly segments: readonly Segment[];
  readonly closed: boolean;
  readonly start: Vec | undefined;
}

const contoursOf = (outline: Geometry): Run[] => {
  const straight = (from: Vec, to: Vec): Cubic => [from, to, to];

  const chain = (points: readonly Vec[], closed: boolean): Run => {
    const ends = closed && points.length > 1 ? [...points, points[0]!] : points;

    return {
      segments: ends
        .slice(1)
        .map((to, i): Segment => ({ from: ends[i]!, curve: straight(ends[i]!, to) })),
      closed,
      start: points[0],
    };
  };

  switch (outline.kind) {
    case "line":
      return [chain([outline.from, outline.to], false)];
    case "polygon":
      return [chain(outline.points, outline.closed)];
    case "path":
      return outline.contours.map((contour) => {
        const segments: Segment[] = [];
        let from = contour.start;

        for (const curve of contour.curves) {
          segments.push({ from, curve });
          from = curve[2];
        }

        if (
          contour.closed &&
          Math.hypot(from[0] - contour.start[0], from[1] - contour.start[1]) > EPS
        )
          segments.push({ from, curve: straight(from, contour.start) });

        return { segments, closed: contour.closed, start: contour.start };
      });
    default:
      return [];
  }
};

const contourReach = (
  { segments, closed, start }: Run,
  h: number,
  { cap, join }: StrokeLook,
): Vec[] => {
  const drawn = segments.flatMap((segment) => {
    const way = tangents(segment);

    return way ? [{ segment, way }] : [];
  });

  if (drawn.length === 0) {
    const dot = start ?? segments[0]?.from;

    return dot !== undefined && cap !== "butt"
      ? corners(grown({ x: dot[0], y: dot[1], width: 0, height: 0 }, h))
      : [];
  }

  const out: Vec[] = [];

  for (const { segment, way } of drawn) {
    const { from, curve } = segment;
    const to = curve[2];

    out.push(
      add(from, times(normal(way[0]), h)),
      add(from, times(normal(way[0]), -h)),
      add(to, times(normal(way[1]), h)),
      add(to, times(normal(way[1]), -h)),
    );

    if (isStraight(segment)) continue;
    const [c1, c2] = curve;

    for (const t of turning(from[0], c1[0], c2[0], to[0]))
      if (t > 0 && t < 1) {
        const p = pointOn(segment, t);

        out.push([p[0] - h, p[1]], [p[0] + h, p[1]]);
      }

    for (const t of turning(from[1], c1[1], c2[1], to[1]))
      if (t > 0 && t < 1) {
        const p = pointOn(segment, t);

        out.push([p[0], p[1] - h], [p[0], p[1] + h]);
      }
  }

  const corner = (incoming: Vec, outgoing: Vec, at: Vec): void => {
    const bend = cross(incoming, outgoing);
    const along = dot(incoming, outgoing);

    if (Math.abs(bend) <= 1e-9 && along > 0) return;

    const side = Math.abs(bend) <= 1e-9 ? 1 : -Math.sign(bend);
    const before = times(normal(incoming), side);
    const after = times(normal(outgoing), side);

    if (join === "round") {
      const sweep =
        Math.abs(bend) <= 1e-9
          ? -Math.PI * side
          : Math.atan2(cross(before, after), dot(before, after));

      out.push(...arcReach(at, h, before, sweep));
    } else if (join === "miter") {
      const ratio = 1 / Math.sqrt(Math.max(EPS, (1 + along) / 2));
      const middle = unit(add(before, after));

      if (ratio <= MITER_LIMIT && middle) out.push(add(at, times(middle, h * ratio)));
    }
  };

  drawn.forEach(({ segment, way }, i) => {
    const next = drawn[i + 1] ?? (closed ? drawn[0] : undefined);

    if (next) corner(way[1], next.way[0], segment.curve[2]);
  });

  if (!closed && cap !== "butt") {
    const first = drawn[0]!;
    const last = drawn.at(-1)!;

    for (const [at, out_] of [
      [first.segment.from, times(first.way[0], -1)],
      [last.segment.curve[2], last.way[1]],
    ] as const) {
      const n = normal(out_);

      if (cap === "square")
        out.push(
          add(add(at, times(n, h)), times(out_, h)),
          add(add(at, times(n, -h)), times(out_, h)),
        );
      else out.push(...arcReach(at, h, n, -Math.PI));
    }
  }

  return out;
};

export const paintedBoxOf = (outline: Geometry, stroke: StrokeLook | undefined): Box => {
  const bare = boxOf(outline);

  if (!stroke || !(stroke.width > 0)) return bare;
  const h = stroke.width / 2;

  const loose =
    stroke.cut && stroke.cap !== "butt"
      ? corners(grown(bare, stroke.cap === "square" ? h * Math.SQRT2 : h))
      : [];

  switch (outline.kind) {
    case "rect":
    case "ellipse":
      return grown(bare, h);
    case "arc": {
      if (stroke.cap !== "square" || Math.abs(outline.sweep) >= 360) return grown(bare, h);

      const ends = [outline.start, outline.start + outline.sweep].flatMap((angle, i): Vec[] => {
        const at = onCircle(outline.radius, angle);
        const radial = unit(at) ?? [1, 0];
        const ahead = times(normal(radial), (i === 0 ? -1 : 1) * Math.sign(outline.sweep || 1));

        return [1, -1].map((side) => add(add(at, times(radial, side * h)), times(ahead, h)));
      });

      return around([...corners(grown(bare, h)), ...ends, ...loose]);
    }

    default: {
      const points = contoursOf(outline).flatMap((run) => contourReach(run, h, stroke));

      return points.length === 0 ? bare : around([...points, ...loose]);
    }
  }
};

export const lookOf = (
  { stroke, trim }: Pick<ShapeNode, "stroke" | "trim">,
  width?: number,
): StrokeLook | undefined =>
  stroke && {
    width: width ?? atRest(stroke.width),
    cap: stroke.cap,
    join: stroke.join,
    cut: stroke.dash !== undefined || trim !== undefined,
  };
