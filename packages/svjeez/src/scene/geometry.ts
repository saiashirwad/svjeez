import { easeAt, easeBetween } from "../ease-at";
import { ease, type Ease } from "../motion";
import { matchRings } from "../paths";
import type { Contour, Cubic, Geometry, Key, Lane, Vec } from "./ir";
import { onCircle } from "./values";

/**
 * Geometry as values that move: every kind written as contours of cubic curves, the way between two geometries, and
 * the matching that makes any two geometries blend. Lowering runs `matched` over a track's keys, so a lane holds one
 * kind and a backend only interpolates.
 */

const lerp = (a: Vec, b: Vec, u: number): Vec => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

const straight = (from: Vec, to: Vec): Cubic => [lerp(from, to, 1 / 3), lerp(from, to, 2 / 3), to];

/** How far a cubic's control points sit along the tangent to follow a quarter circle of radius 1. */
const KAPPA = (4 / 3) * Math.tan(Math.PI / 8);

/** The pieces an arc's contour has unless a caller asks for more: one cubic for each quarter turn or less. */
export const arcPieces = (sweep: number): number =>
  Math.max(1, Math.ceil(Math.abs(sweep) / 90 - 1e-9));

const arcCurves = (radius: number, start: number, sweep: number, pieces: number): Cubic[] => {
  const step = sweep / pieces;
  const reach = (4 / 3) * Math.tan((step * Math.PI) / 720) * radius;

  return Array.from({ length: pieces }, (_, i): Cubic => {
    const [a, b] = [start + i * step, start + (i + 1) * step];
    const [from, to] = [onCircle(radius, a), onCircle(radius, b)];
    // The tangent at angle θ, clockwise, is (-sin θ, cos θ).
    const [ta, tb] = [onCircle(1, a + 90), onCircle(1, b + 90)];

    return [
      [from[0] + ta[0] * reach, from[1] + ta[1] * reach],
      [to[0] - tb[0] * reach, to[1] - tb[1] * reach],
      to,
    ];
  });
};

/**
 * The same outline as contours of cubics, starting where SVG starts drawing that shape so a trim means the same on
 * both. Every geometry of one kind gives the same structure: a rect always has four sides and four corners (a sharp
 * corner is a curve of no length), an ellipse four quarters, an arc `pieces` cubics.
 */
export const contoursOf = (geometry: Geometry, pieces?: number): Contour[] => {
  switch (geometry.kind) {
    case "rect": {
      const [w, h] = geometry.size;
      const [tl, tr, br, bl] = geometry.radius;

      // A quarter circle from `from` to `to` around the corner `bend`. Its points move in step with the radius, so
      // two rects blend into the rect between them.
      const round = (from: Vec, to: Vec, bend: Vec): Cubic => [
        lerp(from, bend, KAPPA),
        lerp(to, bend, KAPPA),
        to,
      ];

      const points: Vec[] = [
        [tl, 0],
        [w - tr, 0],
        [w, tr],
        [w, h - br],
        [w - br, h],
        [bl, h],
        [0, h - bl],
        [0, tl],
      ];

      const bends: Vec[] = [
        [w, 0],
        [w, h],
        [0, h],
        [0, 0],
      ];

      const curves: Cubic[] = [];

      for (let side = 0; side < 4; side++) {
        const [from, to] = [points[side * 2]!, points[side * 2 + 1]!];
        const next = points[(side * 2 + 2) % 8]!;

        curves.push(straight(from, to), round(to, next, bends[side]!));
      }

      return [{ start: points[0]!, curves, closed: true }];
    }

    case "ellipse": {
      const [rx, ry] = geometry.radius;

      const stretch = (curve: Cubic): Cubic => {
        const [c1, c2, to] = curve;

        return [
          [c1[0] * rx, c1[1] * ry],
          [c2[0] * rx, c2[1] * ry],
          [to[0] * rx, to[1] * ry],
        ];
      };

      return [{ start: [rx, 0], curves: arcCurves(1, 0, 360, 4).map(stretch), closed: true }];
    }

    case "arc": {
      const { radius, start, sweep } = geometry;

      return [
        {
          start: onCircle(radius, start),
          curves: arcCurves(radius, start, sweep, pieces ?? arcPieces(sweep)),
          closed: false,
        },
      ];
    }

    case "line":
      return [
        { start: geometry.from, curves: [straight(geometry.from, geometry.to)], closed: false },
      ];
    case "polygon": {
      const [first, ...rest] = geometry.points;

      if (!first) return [];
      const ends = geometry.closed ? [...rest, first] : rest;
      const curves = ends.map((to, i) => straight(i === 0 ? first : rest[i - 1]!, to));

      return [{ start: first, curves, closed: geometry.closed }];
    }

    case "path":
      return [...geometry.contours];
  }
};

const mixAll = (a: readonly Vec[], b: readonly Vec[], u: number): Vec[] =>
  a.map((point, i) => lerp(point, b[i]!, u));

const mixCurve = (a: Cubic, b: Cubic, u: number): Cubic => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
  lerp(a[2], b[2], u),
];

const same = (a: readonly Contour[], b: readonly Contour[]): boolean =>
  a.length === b.length &&
  a.every(
    (contour, i) =>
      contour.closed === b[i]!.closed && contour.curves.length === b[i]!.curves.length,
  );

const mixNumber = (a: number, b: number, u: number): number => a + (b - a) * u;

/**
 * The geometry `amount` of the way from `a` to `b`, by parameter: a rect between two rects, an arc between two arcs.
 * Both are one kind with one structure, as `matched` leaves every key of a lane.
 */
export const mixGeometry = (a: Geometry, b: Geometry, amount: number, where: string): Geometry => {
  const u = amount;

  switch (a.kind) {
    case "rect":
      if (b.kind !== "rect") break;

      return {
        kind: "rect",
        size: lerp(a.size, b.size, u),
        radius: [
          mixNumber(a.radius[0], b.radius[0], u),
          mixNumber(a.radius[1], b.radius[1], u),
          mixNumber(a.radius[2], b.radius[2], u),
          mixNumber(a.radius[3], b.radius[3], u),
        ],
      };
    case "ellipse":
      if (b.kind !== "ellipse") break;

      return { kind: "ellipse", radius: lerp(a.radius, b.radius, u) };
    case "arc":
      if (b.kind !== "arc") break;

      return {
        kind: "arc",
        radius: mixNumber(a.radius, b.radius, u),
        start: mixNumber(a.start, b.start, u),
        sweep: mixNumber(a.sweep, b.sweep, u),
      };
    case "line":
      if (b.kind !== "line") break;

      return { kind: "line", from: lerp(a.from, b.from, u), to: lerp(a.to, b.to, u) };
    case "polygon":
      if (b.kind !== "polygon" || b.points.length !== a.points.length || b.closed !== a.closed)
        break;

      return { kind: "polygon", points: mixAll(a.points, b.points, u), closed: a.closed };
    case "path":
      if (b.kind !== "path" || !same(a.contours, b.contours)) break;

      return {
        kind: "path",
        rule: a.rule,
        contours: a.contours.map((contour, i) => {
          const other = b.contours[i]!;

          return {
            start: lerp(contour.start, other.start, u),
            curves: contour.curves.map((curve, k) => mixCurve(curve, other.curves[k]!, u)),
            closed: contour.closed,
          };
        }),
      };
  }

  throw new Error(
    `${where} blends a ${a.kind} into a ${b.kind} that has another structure. Lower geometry keys through matched() first.`,
  );
};

const alike = (values: readonly Geometry[]): boolean => {
  const [first, ...rest] = values;

  if (!first) return true;

  return rest.every((value) => {
    if (value.kind !== first.kind) return false;

    if (value.kind === "polygon" && first.kind === "polygon")
      return value.points.length === first.points.length && value.closed === first.closed;

    if (value.kind === "path" && first.kind === "path")
      return value.rule === first.rule && same(value.contours, first.contours);

    return true;
  });
};

/**
 * The keys of one geometry lane, made blendable. Keys of one parametric kind (and polygons with as many points) stay
 * that kind and blend by parameter, and paths that already match stay as written. Anything else becomes paths whose
 * points `matchRings` pairs up. A contour that is closed in one key and open in another is open in all: its last
 * curve still runs back to the start, so only the join at the start becomes two caps.
 */
export const matched = (values: readonly Geometry[], where: string): Geometry[] => {
  if (values.length === 0 || alike(values)) return [...values];
  const rules = new Set(values.flatMap((value) => (value.kind === "path" ? [value.rule] : [])));

  if (rules.size > 1)
    throw new Error(
      `${where} morphs between a nonzero and an evenodd path, and a fill rule can't blend. Give every key one rule.`,
    );

  const outlines = values.map((value) => {
    const contours = contoursOf(value);

    if (contours.length === 0)
      throw new Error(
        `${where} morphs to or from a ${value.kind} with no outline. Give every key a point at least.`,
      );

    return contours;
  });

  const rings = matchRings(outlines);
  const open = rings[0]!.map((_, r) => rings.some((each) => !each[r]!.closed));
  const [rule] = rules;

  return rings.map((each) => ({
    kind: "path",
    rule: rule ?? "nonzero",
    contours: each.map((ring, r) => ({ ...ring, closed: ring.closed && !open[r] })),
  }));
};

/** Whether SMIL can write `curve`: keySplines take control points from 0 to 1 only, and drop the whole animation otherwise. */
const smilWritable = (curve: Ease | undefined): boolean =>
  curve?.kind !== "bezier" || [curve.points[1], curve.points[3]].every((y) => y >= 0 && y <= 1);

/** How many pieces a transition SMIL can't write is cut into. Each piece keeps its part of the curve when it can. */
const PIECES = 8;

/**
 * `lane` as SMIL can write it: each transition whose ease overshoots (`ease.back`, or the keys a spring or a followed
 * anchor is fitted with) is cut into pieces, each with its own part of the ease, or a straight line where that part
 * still overshoots. The values at the cuts are the lane's own, so the path is the same where it is cut.
 */
export const smilSafe = (lane: Lane<Geometry>, where: string): Lane<Geometry> =>
  smilSafeWith(lane, mixGeometry, where);

/** `smilSafe` for a lane of any value that `mix` blends. */
export const smilSafeWith = <T>(
  lane: Lane<T>,
  mix: (a: T, b: T, amount: number, where: string) => T,
  where: string,
): Lane<T> => {
  if (lane.keys.every((key) => smilWritable(key.ease))) return lane;
  const [first] = lane.keys;
  const keys: Key<T>[] = [first];

  lane.keys.slice(1).forEach((key, i) => {
    const from = lane.keys[i]!;
    const curve = key.ease;

    if (!curve || smilWritable(curve)) {
      keys.push(key);

      return;
    }

    for (let piece = 1; piece <= PIECES; piece++) {
      const [start, end] = [(piece - 1) / PIECES, piece / PIECES];
      const part = easeBetween(curve, start, end, where);

      keys.push({
        t: from.t + (key.t - from.t) * end,
        value: piece === PIECES ? key.value : mix(from.value, key.value, easeAt(curve, end), where),
        ease: smilWritable(part) ? part : ease.linear,
      });
    }
  });

  const [head, next, ...rest] = keys;

  return { ...lane, keys: [head!, next!, ...rest] };
};
