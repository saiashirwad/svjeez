import { SceneError } from "./scene-error";
import { easeAt, easeBetween, staysInside } from "./ease-at";
import { ease } from "./time";
import { matchRings } from "./paths";
import type { Box, Contour, Cubic, Geometry, Key, Lane, Vec } from "./ir";
import { alongCurve, curveLength, lerpPoint, lineCubic, type Controls } from "./curve";

const DEG = Math.PI / 180;
const KAPPA = (4 / 3) * Math.tan(Math.PI / 8);

export const boxCorners = ({ x, y, width, height }: Box): [Vec, Vec, Vec, Vec] => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
];

export const growBox = ({ x, y, width, height }: Box, by: number): Box => ({
  x: x - by,
  y: y - by,
  width: width + by * 2,
  height: height + by * 2,
});

export const boundsOfPoints = (points: readonly Vec[]): Box => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

export const onCircle = (radius: number, angle: number): Vec => [
  radius * Math.cos(angle * DEG),
  radius * Math.sin(angle * DEG),
];

const extremes = (a: number, b: number, c: number, d: number): number[] => {
  const [p, q, r] = [-a + 3 * b - 3 * c + d, 2 * (a - 2 * b + c), -a + b];

  const roots =
    Math.abs(p) < 1e-12
      ? Math.abs(q) < 1e-12
        ? []
        : [-r / q]
      : [1, -1].map((sign) => (-q + sign * Math.sqrt(Math.max(0, q * q - 4 * p * r))) / (2 * p));

  return [a, d].concat(
    roots
      .filter((t) => t > 0 && t < 1 && q * q - 4 * p * r >= 0)
      .map((t) => {
        const s = 1 - t;

        return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d;
      }),
  );
};

const around = (xs: readonly number[], ys: readonly number[]): Box => {
  if (xs.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const [x, y] = [Math.min(...xs), Math.min(...ys)];

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

export const outlineBoxOf = (outline: Geometry): Box => {
  switch (outline.kind) {
    case "rect":
      return { x: 0, y: 0, width: outline.size[0], height: outline.size[1] };
    case "ellipse": {
      const [rx, ry] = outline.radius;

      return { x: -rx, y: -ry, width: rx * 2, height: ry * 2 };
    }

    case "arc": {
      const r = outline.radius;

      return { x: -r, y: -r, width: r * 2, height: r * 2 };
    }

    case "line":
      return around([outline.from[0], outline.to[0]], [outline.from[1], outline.to[1]]);
    case "polygon":
      return around(
        outline.points.map((point) => point[0]),
        outline.points.map((point) => point[1]),
      );
    case "path": {
      const xs: number[] = [];
      const ys: number[] = [];

      for (const contour of outline.contours) {
        let from = contour.start;

        xs.push(from[0]);
        ys.push(from[1]);

        for (const [c1, c2, to] of contour.curves) {
          xs.push(...extremes(from[0], c1[0], c2[0], to[0]));
          ys.push(...extremes(from[1], c1[1], c2[1], to[1]));
          from = to;
        }
      }

      return around(xs, ys);
    }
  }
};

export const arcPieces = (sweep: number): number =>
  Math.max(1, Math.ceil(Math.abs(sweep) / 90 - 1e-9));

const arcCurves = (radius: number, start: number, sweep: number, pieces: number): Cubic[] => {
  const step = sweep / pieces;
  const reach = (4 / 3) * Math.tan((step * Math.PI) / 720) * radius;

  return Array.from({ length: pieces }, (_, i): Cubic => {
    const [a, b] = [start + i * step, start + (i + 1) * step];
    const [from, to] = [onCircle(radius, a), onCircle(radius, b)];
    const [ta, tb] = [onCircle(1, a + 90), onCircle(1, b + 90)];

    return [
      [from[0] + ta[0] * reach, from[1] + ta[1] * reach],
      [to[0] - tb[0] * reach, to[1] - tb[1] * reach],
      to,
    ];
  });
};

export const contoursOf = (geometry: Geometry, pieces?: number): Contour[] => {
  switch (geometry.kind) {
    case "rect": {
      const [w, h] = geometry.size;
      const [tl, tr, br, bl] = geometry.radius;

      const round = (from: Vec, to: Vec, bend: Vec): Cubic => [
        lerpPoint(from, bend, KAPPA),
        lerpPoint(to, bend, KAPPA),
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

        curves.push(lineCubic(from, to), round(to, next, bends[side]!));
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
        { start: geometry.from, curves: [lineCubic(geometry.from, geometry.to)], closed: false },
      ];
    case "polygon": {
      const [first, ...rest] = geometry.points;

      if (!first) return [];
      const ends = geometry.closed ? [...rest, first] : rest;
      const curves = ends.map((to, i) => lineCubic(i === 0 ? first : rest[i - 1]!, to));

      return [{ start: first, curves, closed: geometry.closed }];
    }

    case "path":
      return [...geometry.contours];
  }
};

const mixAll = (a: readonly Vec[], b: readonly Vec[], u: number): Vec[] =>
  a.map((point, i) => lerpPoint(point, b[i]!, u));

const mixCurve = (a: Cubic, b: Cubic, u: number): Cubic => [
  lerpPoint(a[0], b[0], u),
  lerpPoint(a[1], b[1], u),
  lerpPoint(a[2], b[2], u),
];

const same = (a: readonly Contour[], b: readonly Contour[]): boolean =>
  a.length === b.length &&
  a.every(
    (contour, i) =>
      contour.closed === b[i]!.closed && contour.curves.length === b[i]!.curves.length,
  );

const mixNumber = (a: number, b: number, u: number): number => a + (b - a) * u;

export const mixGeometry = (a: Geometry, b: Geometry, amount: number, where: string): Geometry => {
  const u = amount;

  switch (a.kind) {
    case "rect":
      if (b.kind !== "rect") break;

      return {
        kind: "rect",
        size: lerpPoint(a.size, b.size, u),
        radius: [
          mixNumber(a.radius[0], b.radius[0], u),
          mixNumber(a.radius[1], b.radius[1], u),
          mixNumber(a.radius[2], b.radius[2], u),
          mixNumber(a.radius[3], b.radius[3], u),
        ],
      };
    case "ellipse":
      if (b.kind !== "ellipse") break;

      return { kind: "ellipse", radius: lerpPoint(a.radius, b.radius, u) };
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

      return { kind: "line", from: lerpPoint(a.from, b.from, u), to: lerpPoint(a.to, b.to, u) };
    case "polygon":
      if (b.kind !== "polygon" || b.points.length !== a.points.length || b.closed !== a.closed)
        break;

      return { kind: "polygon", points: mixAll(a.points, b.points, u), closed: a.closed };
    case "path":
      if (b.kind !== "path" || a.rule !== b.rule || !same(a.contours, b.contours)) break;

      return {
        kind: "path",
        rule: a.rule,
        contours: a.contours.map((contour, i) => {
          const other = b.contours[i]!;

          return {
            start: lerpPoint(contour.start, other.start, u),
            curves: contour.curves.map((curve, k) => mixCurve(curve, other.curves[k]!, u)),
            closed: contour.closed,
          };
        }),
      };
  }

  throw new Error(
    `${where} blends a ${a.kind} into a ${b.kind} of another structure, which lowering never writes. This is a bug in svjeez; please report it with the scene.`,
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

export const matched = (values: readonly Geometry[], where: string): Geometry[] => {
  if (values.length === 0 || alike(values)) return [...values];
  const rules = new Set(values.flatMap((value) => (value.kind === "path" ? [value.rule] : [])));

  if (rules.size > 1)
    throw new SceneError(
      `${where} morphs between a nonzero and an evenodd path, and a fill rule can't blend. Give every key one rule.`,
    );

  const outlines = values.map((value) => {
    const contours = contoursOf(value);

    if (contours.length === 0)
      throw new SceneError(
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

const PIECES = 8;

export const smilSafe = (lane: Lane<Geometry>, where: string): Lane<Geometry> =>
  smilSafeWith(lane, mixGeometry, where);

export const smilSafeWith = <T>(
  lane: Lane<T>,
  mix: (a: T, b: T, amount: number, where: string) => T,
  where: string,
): Lane<T> => {
  if (lane.keys.every((key) => staysInside(key.ease))) return lane;
  const [first] = lane.keys;
  const keys: Key<T>[] = [first];

  lane.keys.slice(1).forEach((key, i) => {
    const from = lane.keys[i]!;
    const curve = key.ease;

    if (!curve || staysInside(curve)) {
      keys.push(key);

      return;
    }

    for (let piece = 1; piece <= PIECES; piece++) {
      const [start, end] = [(piece - 1) / PIECES, piece / PIECES];
      const part = easeBetween(curve, start, end, where);

      keys.push({
        t: from.t + (key.t - from.t) * end,
        value: piece === PIECES ? key.value : mix(from.value, key.value, easeAt(curve, end), where),
        ease: staysInside(part) ? part : ease.linear,
      });
    }
  });

  const [head, next, ...rest] = keys;

  return { ...lane, keys: [head!, next!, ...rest] };
};

export const lengthOf = (geometry: Geometry): number => {
  switch (geometry.kind) {
    case "rect": {
      const [w, h] = geometry.size;
      const corners = geometry.radius.reduce((sum, r) => sum + r * (Math.PI / 2 - 2), 0);

      return 2 * (w + h) + corners;
    }

    case "ellipse": {
      const [a, b] = geometry.radius;
      const k = ((a - b) / (a + b)) ** 2;

      return a + b === 0 ? 0 : Math.PI * (a + b) * (1 + (3 * k) / (10 + Math.sqrt(4 - 3 * k)));
    }

    case "arc":
      return (geometry.radius * Math.abs(geometry.sweep) * Math.PI) / 180;
    default:
      return contoursOf(geometry).reduce((sum, { start, curves, closed }) => {
        let from = start;
        let length = 0;

        for (const [c1, c2, to] of curves) {
          length += curveLength(from, [c1, c2], to);
          from = to;
        }

        return sum + length + (closed ? Math.hypot(start[0] - from[0], start[1] - from[1]) : 0);
      }, 0);
  }
};

interface Piece {
  readonly from: Vec;
  readonly via: Controls;
  readonly to: Vec;
}

export interface Heading {
  readonly point: Vec;
  readonly angle: number;
}

/** The point and heading (radians) `distance` along the outline, held at its ends. */
export const alongOutline = (geometry: Geometry, distance: number): Heading => {
  const pieces = contoursOf(geometry).flatMap(({ start, curves, closed }) => {
    const all = closed ? [...curves, lineCubic(curves.at(-1)?.[2] ?? start, start)] : curves;

    return all.map((curve, i): Piece => ({
      from: i === 0 ? start : all[i - 1]![2],
      via: [curve[0], curve[1]],
      to: curve[2],
    }));
  });

  let left = Math.max(0, distance);

  for (const [i, { from, via, to }] of pieces.entries()) {
    const length = curveLength(from, via, to);

    if (left > length && i < pieces.length - 1) {
      left -= length;
      continue;
    }

    const share = length > 0 ? Math.min(1, left / length) : 0;
    const [before, after] = [Math.max(0, share - 0.01), Math.min(1, share + 0.01)];
    const [a, b] = [alongCurve(from, via, to, before), alongCurve(from, via, to, after)];

    return { point: alongCurve(from, via, to, share), angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }

  return { point: [0, 0], angle: 0 };
};
