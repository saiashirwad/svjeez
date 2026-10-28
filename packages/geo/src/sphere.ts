import type { Feature, FeatureCollection, Geometry, Polygon, Position } from "geojson";
import type { LonLat } from "./index.ts";

/** Any GeoJSON that can carry lines or rings. */
export type Outline = Geometry | Feature | FeatureCollection;

/** A point on the unit sphere: x toward 0°E on the equator, y toward 90°E, z toward the north pole. */
export type Vec3 = readonly [number, number, number];

export const RAD = Math.PI / 180;

export const ORIGIN: Vec3 = [0, 0, 0];

export const vec = ([lon, lat]: readonly [number, number] | readonly number[]): Vec3 => {
  const [l, p] = [lon! * RAD, lat! * RAD];

  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};

export const lonLat = ([x, y, z]: Vec3): LonLat => [
  Math.atan2(y, x) / RAD,
  Math.asin(Math.max(-1, Math.min(1, z))) / RAD,
];

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const unit = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(...a));

/** Radians between two points on the sphere. */
export const angle = (a: Vec3, b: Vec3) => Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));

/** The great circle from `a` to `b`, `u` of the way along. */
export const slerp = (a: Vec3, b: Vec3, u: number): Vec3 => {
  const theta = angle(a, b);

  if (theta < 1e-9) return a;
  const [wa, wb] = [Math.sin((1 - u) * theta), Math.sin(u * theta)];

  return scale(add(scale(a, wa), scale(b, wb)), 1 / Math.sin(theta));
};

/** One ring or line of a shape, as points on the sphere. A ring's last point joins back to its first. */
export interface Strand {
  readonly points: readonly Vec3[];
  readonly closed: boolean;
}

/** A polygon with its holes, or one line: the strands that must be drawn together. */
export interface Unit {
  readonly strands: readonly Strand[];
  /** The polygon, to test what it covers. Lines have none. */
  readonly polygon?: Polygon;
}

/** The polygons and lines of any GeoJSON, in order. Polygon rings drop their repeated last point. */
export const units = (object: Outline): Unit[] => {
  const ring = (positions: readonly Position[]): Strand => ({
    points: positions.slice(0, -1).map(vec),
    closed: true,
  });

  const line = (positions: readonly Position[]): Unit => ({
    strands: [{ points: positions.map(vec), closed: false }],
  });

  const polygon = (coordinates: Position[][]): Unit => ({
    strands: coordinates.map(ring),
    polygon: { type: "Polygon", coordinates },
  });

  const geometry = (g: Geometry | null): Unit[] => {
    if (!g) return [];

    switch (g.type) {
      case "Point":
      case "MultiPoint":
        return [];
      case "LineString":
        return [line(g.coordinates)];
      case "MultiLineString":
        return g.coordinates.map(line);
      case "Polygon":
        return [polygon(g.coordinates)];
      case "MultiPolygon":
        return g.coordinates.map(polygon);
      case "GeometryCollection":
        return g.geometries.flatMap(geometry);
    }
  };

  switch (object.type) {
    case "Feature":
      return geometry(object.geometry);
    case "FeatureCollection":
      return object.features.flatMap((f) => geometry(f.geometry));
    default:
      return geometry(object);
  }
};

/**
 * Douglas–Peucker on the sphere: drops the points that sit within `degrees` of the great circle their neighbours
 * already draw. A ring keeps at least three points, a line two.
 */
const simplifyPoints = (points: readonly Vec3[], degrees: number): Vec3[] => {
  if (points.length < 3 || degrees <= 0) return [...points];
  const epsilon = Math.sin(degrees * RAD);
  const keep = new Uint8Array(points.length);
  const stack: [number, number][] = [[0, points.length - 1]];
  keep[0] = keep[points.length - 1] = 1;

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const [a, b] = [points[first]!, points[last]!];
    const normal = cross(a, b);
    const length = Math.hypot(...normal);
    let far = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const p = points[i]!;
      const distance = length > 1e-12 ? Math.abs(dot(p, normal)) / length : Math.sin(angle(p, a));

      if (distance > far) [far, index] = [distance, i];
    }

    if (far > epsilon) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
};

/** Splits every leg longer than `degrees` along its great circle. */
const densify = (points: readonly Vec3[], closed: boolean, degrees: number): Vec3[] => {
  const out: Vec3[] = [];
  const legs = closed ? points.length : points.length - 1;

  for (let i = 0; i < legs; i++) {
    const [a, b] = [points[i]!, points[(i + 1) % points.length]!];
    const pieces = Math.max(1, Math.ceil(angle(a, b) / (degrees * RAD)));

    for (let k = 0; k < pieces; k++) out.push(slerp(a, b, k / pieces));
  }

  if (!closed) out.push(points.at(-1)!);

  return out;
};

/** Points that land on the same place, as the two ends of a ring cut at the antimeridian do, or the corners of a pole. */
const dedupe = (points: readonly Vec3[]): Vec3[] =>
  points.filter((p, i) => i === 0 || angle(p, points[i - 1]!) > 1e-7);

const ready = (strand: Strand, simplify: number, step: number): Strand[] => {
  const kept = dedupe(strand.points.filter((p) => Math.abs(p[2]) < 1 - 1e-9));
  const loop = strand.closed && kept.length > 1 && angle(kept[0]!, kept.at(-1)!) < 1e-7;
  const points = simplifyPoints(loop ? kept.slice(0, -1) : kept, simplify);

  if (points.length < (strand.closed ? 3 : 2)) return [];

  return [{ points: densify(points, strand.closed, step), closed: strand.closed }];
};

/**
 * Every polygon and line of `object` ready to turn: simplified to within `simplify` degrees, with legs split to at
 * most `step` degrees so they bend with the globe. Points at a pole and the cut a ring makes along the antimeridian
 * go, since on the sphere they draw nothing. A ring smaller than `simplify` goes too, and a polygon whose outer ring
 * goes takes its holes with it.
 */
export const prepare = (object: Outline, simplify: number, step: number): Unit[] =>
  units(object).flatMap((unit): Unit[] => {
    const [outer, ...holes] = unit.strands;
    const first = outer ? ready(outer, simplify, step) : [];

    if (first.length === 0) return [];

    return [
      {
        ...unit,
        strands: [...first, ...holes.flatMap((hole) => ready(hole, simplify, step))],
      },
    ];
  });
