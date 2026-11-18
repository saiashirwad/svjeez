import { SceneError } from "../model/scene-error";
import { contoursOf } from "../model/geometry";
import type { Contour, Geometry as Outline, Vec } from "../model/ir";
import { outlineOf, type Geometry } from "./values";

const PIECES = 24;

const flatten = (contour: Contour): Vec[] => {
  const points: Vec[] = [contour.start];
  let from = contour.start;

  for (const [c1, c2, to] of contour.curves) {
    for (let i = 1; i <= PIECES; i++) {
      const t = i / PIECES;
      const s = 1 - t;
      const [a, b, c, d] = [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];

      points.push([
        a * from[0] + b * c1[0] + c * c2[0] + d * to[0],
        a * from[1] + b * c1[1] + c * c2[1] + d * to[1],
      ]);
    }

    from = to;
  }

  return points.filter(
    (point, i) =>
      i === 0 || Math.hypot(point[0] - points[i - 1]![0], point[1] - points[i - 1]![1]) > 1e-9,
  );
};

const edgesOf = (ring: readonly Vec[]): [Vec, Vec][] =>
  ring.flatMap((a, i): [Vec, Vec][] => {
    const b = ring[(i + 1) % ring.length]!;

    return Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-9 ? [[a, b]] : [];
  });

const cross = (o: Vec, a: Vec, b: Vec): number =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

const meet = ([a, b]: [Vec, Vec], [c, d]: [Vec, Vec]): boolean => {
  const scale = Math.max(1, ...[a, b, c, d].flat().map(Math.abs));
  const tiny = 1e-9 * scale * scale;
  const [d1, d2, d3, d4] = [cross(c, d, a), cross(c, d, b), cross(a, b, c), cross(a, b, d)];

  const within = (p: Vec, q: Vec, r: Vec): boolean =>
    Math.min(p[0], q[0]) - 1e-9 * scale <= r[0] &&
    r[0] <= Math.max(p[0], q[0]) + 1e-9 * scale &&
    Math.min(p[1], q[1]) - 1e-9 * scale <= r[1] &&
    r[1] <= Math.max(p[1], q[1]) + 1e-9 * scale;

  if (
    ((d1 > tiny && d2 < -tiny) || (d1 < -tiny && d2 > tiny)) &&
    ((d3 > tiny && d4 < -tiny) || (d3 < -tiny && d4 > tiny))
  )
    return true;

  return (
    (Math.abs(d1) <= tiny && within(c, d, a)) ||
    (Math.abs(d2) <= tiny && within(c, d, b)) ||
    (Math.abs(d3) <= tiny && within(a, b, c)) ||
    (Math.abs(d4) <= tiny && within(a, b, d))
  );
};

const crosses = (a: readonly Vec[], b: readonly Vec[]): boolean => {
  const others = edgesOf(b);

  return edgesOf(a).some((edge) => others.some((other) => meet(edge, other)));
};

const tangled = (ring: readonly Vec[]): boolean => {
  const edges = edgesOf(ring);

  return edges.some((edge, i) =>
    edges.some(
      (other, k) => k > i + 1 && !(i === 0 && k === edges.length - 1) && meet(edge, other),
    ),
  );
};

const inside = (ring: readonly Vec[], [x, y]: Vec): boolean => {
  let odd = false;

  for (const [[ax, ay], [bx, by]] of edgesOf(ring))
    if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) odd = !odd;

  return odd;
};

const same = (a: Vec, b: Vec): boolean => a[0] === b[0] && a[1] === b[1];

const tidy = (contour: Contour): Contour => {
  let from = contour.start;

  const curves = contour.curves.filter(([c1, c2, to]) => {
    const kept = !(same(from, c1) && same(c1, c2) && same(c2, to));

    from = to;

    return kept;
  });

  return { ...contour, curves };
};

const closed = (outline: Outline, what: string): Contour[] => {
  const contours = contoursOf(outline);

  if (contours.length === 0 || contours.some((contour) => !contour.closed))
    throw new SceneError(
      `subtract() needs closed shapes, and ${what} is open. Close it, or use a rect, circle, ellipse or polygon.`,
    );

  return contours;
};

const plus = ([x, y]: Vec, [dx, dy]: Vec): Vec => [x + dx, y + dy];

export const moved = (geometry: Geometry, by: Vec): Outline => {
  const outline = outlineOf(geometry);

  if (!by.every((n) => Number.isFinite(n)))
    throw new Error(`moved() needs a finite point to move by, got ${JSON.stringify(by)}.`);

  switch (outline.kind) {
    case "line":
      return { ...outline, from: plus(outline.from, by), to: plus(outline.to, by) };
    case "polygon":
      return { ...outline, points: outline.points.map((point) => plus(point, by)) };
    default:
      return {
        kind: "path",
        contours: contoursOf(outline).map((contour) => ({
          start: plus(contour.start, by),
          curves: contour.curves.map(
            ([c1, c2, to]) => [plus(c1, by), plus(c2, by), plus(to, by)] as const,
          ),
          closed: contour.closed,
        })),
        rule: outline.kind === "path" ? outline.rule : "nonzero",
      };
  }
};

export const subtract = (base: Geometry, ...cuts: readonly Geometry[]): Outline => {
  const outline = outlineOf(base);
  const [outer, ...holes] = closed(outline, "the base");

  if (holes.length > 0 && !(outline.kind === "path" && outline.rule === "evenodd"))
    throw new SceneError(
      "subtract() takes a base of one outline, or one subtract() already made. A nonzero path of several contours has no one edge to cut holes inside.",
    );
  const ring = flatten(outer!);

  if (tangled(ring))
    throw new SceneError("subtract() needs a base whose edge never crosses itself.");
  const kept: { readonly contour: Contour; readonly ring: Vec[]; readonly what: string }[] = [];

  const given = [
    ...holes.map((contour, i) => ({ contour, what: `the base's hole ${i + 1}` })),
    ...cuts.flatMap((cut, i) => {
      const contours = closed(outlineOf(cut), `cut ${i + 1}`);

      if (contours.length > 1)
        throw new SceneError(
          `subtract() cuts one outline at a time, and cut ${i + 1} has ${contours.length}. Pass each as a cut of its own.`,
        );

      return [{ contour: contours[0]!, what: `cut ${i + 1}` }];
    }),
  ];

  for (const { contour, what } of given) {
    const own = flatten(contour);

    if (tangled(own))
      throw new SceneError(
        `subtract() needs cuts whose edges never cross themselves, and ${what}'s does.`,
      );

    if (crosses(own, ring))
      throw new SceneError(
        `subtract() cuts holes that lie wholly inside the base or wholly outside it, and ${what} crosses or touches the base's edge. Draw that outline with path() instead.`,
      );

    if (!inside(ring, own[0]!)) {
      if (inside(own, ring[0]!))
        throw new SceneError(
          `subtract()'s ${what} covers the whole base, so nothing would be left.`,
        );
      continue;
    }

    const other = kept.find(
      (each) => crosses(own, each.ring) || inside(each.ring, own[0]!) || inside(own, each.ring[0]!),
    );

    if (other)
      throw new SceneError(
        `subtract()'s ${what} overlaps or touches ${other.what}, and holes that overlap don't cut as one even-odd path. Draw them as one cut.`,
      );
    kept.push({ contour, ring: own, what });
  }

  return {
    kind: "path",
    contours: [outer!, ...kept.map((each) => each.contour)].map(tidy),
    rule: "evenodd",
  };
};
