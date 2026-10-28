import { geoContains } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import { feature, merge, mesh } from "topojson-client";
import type { GeometryObject, MultiPolygon, Polygon } from "topojson-specification";
import {
  sampled,
  sampledPath,
  type Motion,
  type PathData,
  type Point,
  type Rect,
  type Seconds,
} from "svjeez";
import type { GeoData, LonLat } from "./index.ts";
import { sun } from "./sun.ts";
import {
  ORIGIN,
  RAD,
  add,
  angle,
  cross,
  dot,
  prepare,
  scale,
  unit,
  vec,
  type Outline,
  type Strand,
  type Unit,
  type Vec3,
} from "./sphere.ts";

/** How a globe turns: the longitude at its middle runs from `from` to `to` over the span. West is negative, so a day turns from 0 to -360. */
export interface Spin {
  readonly from: number;
  readonly to: number;
  readonly at?: Seconds;
  readonly over: Seconds;
}

export interface GlobeOptions {
  /** The globe is the largest circle centered in `frame`. */
  readonly frame: Rect;
  /** Degrees the north pole leans toward the viewer: the latitude at the globe's middle. Default 0. */
  readonly tilt?: number;
  /** The turn, or a function from time to the `[lon, lat]` at the globe's middle, which ignores `tilt`. */
  readonly spin: Spin | ((t: Seconds) => LonLat);
  /** Seconds every motion runs. Default the end of `spin`. A function `spin` needs it. */
  readonly duration?: Seconds;
  /** The TopoJSON object to read. Default the topology's first object. */
  readonly object?: string;
  /** Keep only the features this returns true for. */
  readonly filter?: (feature: Feature) => boolean;
  /** Degrees. Outlines are simplified on the sphere to within this before they turn. Default 0.6. */
  readonly simplify?: number;
  /** Degrees. Longer legs are split so they bend with the globe. Default 6. */
  readonly step?: number;
  /** Px. How far the replay of a turning path may stray from the true one. Default 1. */
  readonly tolerance?: number;
}

/** A path that moves, ready to spread onto a `<path>`: `<path {...globe.land()} fill="…" />`. */
export interface Turning {
  readonly d: PathData;
  readonly animation: Motion<"d">;
}

/** A place that rides the globe, ready to spread onto a `<g>` drawn at the origin. It fades out over the horizon. */
export interface Riding {
  readonly animation: Motion<"x" | "y" | "opacity">;
}

export interface Globe {
  readonly center: Point;
  readonly radius: number;
  readonly duration: Seconds;
  /** The outline of the globe, for the sea, a rim, and the clip every turning path needs. */
  readonly sphere: string;
  /** The `[lon, lat]` at the globe's middle at `t`. */
  facing(t: Seconds): LonLat;
  /** Where a place is at `t`, and how far it faces the viewer, from 1 at the middle through 0 on the horizon to -1 behind. */
  locate(at: LonLat, t: Seconds): { readonly point: Point; readonly z: number };
  /**
   * Every region filled, as turning paths. From TopoJSON the shared borders are gone, leaving the land. Layers come
   * back in pieces a band of longitude wide, so a piece behind the globe holds still and costs no keys.
   */
  land(): Turning[];
  /** The borders between regions, each drawn once, in pieces. TopoJSON only. */
  borders(): Turning[];
  /** Any GeoJSON polygons and lines, turning, in pieces. */
  path(object: Outline): Turning[];
  /** Lines of longitude and latitude every `step` degrees, one path each. Default 15. */
  graticule(step?: number): Turning[];
  /** The circle `radius` degrees around `center`, as a line. */
  circle(center: LonLat, radius: number): Turning;
  /** The great-circle arc from `from` to `to`, as a line. */
  route(from: LonLat, to: LonLat): Turning;
  /** The half of the globe in darkness, at one date or at a date that changes with time. */
  night(date: Date | ((t: Seconds) => Date)): Turning;
  /** The line between day and night, at one date or at a date that changes with time. */
  terminator(date: Date | ((t: Seconds) => Date)): Turning;
  /** A place that rides the globe and fades out within `fade` of the horizon (default 0.08, about 5 degrees). */
  place(at: LonLat, options?: { readonly fade?: number }): Riding;
}

/** The point the hidden side folds around, at each time, and the parallel it rides. */
interface Pivot {
  readonly at: (t: Seconds) => Vec3;
  readonly lat: number;
}

/** The screen basis at a facing: right, up, and toward the viewer, all on the sphere. */
interface View {
  readonly right: Vec3;
  readonly up: Vec3;
  readonly toward: Vec3;
}

const viewOf = ([lon, lat]: LonLat): View => {
  const [l, p] = [lon * RAD, lat * RAD];

  return {
    right: [-Math.sin(l), Math.cos(l), 0],
    up: [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)],
    toward: vec([lon, lat]),
  };
};

/** How far the hidden side reaches past the rim, as a share of the radius. */
const BEYOND = 1;

/** Degrees between a hidden point's home and the antipode at most, so the far side keeps room around it. */
const REACH = 80;

const SAMPLE = 0.05;

/** Degrees of longitude per path when a layer is split. */
const BAND = 30;

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

const write = (
  rings: readonly (readonly (readonly [number, number])[])[],
  closed: readonly boolean[],
) =>
  // SAFETY: every ring is written starting with M, so the joined string is path data.
  rings
    .map(
      (ring, i) =>
        `M${ring.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(" ")}${closed[i] ? "Z" : ""}`,
    )
    .join("") as PathData;

const features = (data: GeoData, object: string | undefined): Feature[] => {
  if (data.type === "FeatureCollection") return data.features;

  if (data.type === "Feature") return [data];
  const key = object ?? Object.keys(data.objects)[0];
  const source = key === undefined ? undefined : data.objects[key];

  if (!source)
    throw new Error(
      `globe() found no TopoJSON object named ${key}. The topology has ${Object.keys(data.objects).join(", ") || "no objects"}.`,
    );
  const read = feature(data, source);

  return "features" in read ? read.features : [read];
};

/** A turning globe whose land, borders, grid, routes and night are real paths, each a `sampledPath()` with a fixed point count. */
export function globe(data: GeoData, options: GlobeOptions): Globe {
  const { frame, tilt = 0, spin, simplify = 0.6, step = 6, tolerance = 1 } = options;
  const radius = Math.min(frame.w, frame.h) / 2;
  const center = { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 };

  const facing =
    spin instanceof Function
      ? spin
      : (t: Seconds): LonLat => {
          const u = Math.min(1, Math.max(0, (t - (spin.at ?? 0)) / spin.over));

          return [spin.from + (spin.to - spin.from) * u, tilt];
        };

  const duration =
    options.duration ??
    (spin instanceof Function
      ? (() => {
          throw new Error("globe() with a spin function needs a duration, as in { duration: 24 }.");
        })()
      : (spin.at ?? 0) + spin.over);

  if (!(duration > 0)) throw new Error(`globe() needs a positive duration, got ${duration}.`);

  const times = Array.from({ length: Math.ceil(duration / SAMPLE) + 1 }, (_, i) =>
    Math.min(duration, i * SAMPLE),
  );

  const views = new Map<Seconds, View>();

  const view = (t: Seconds) => {
    let found = views.get(t);

    if (!found) views.set(t, (found = viewOf(facing(t))));

    return found;
  };

  const screen = (x: number, y: number): [number, number] => [
    center.x + radius * x,
    center.y - radius * y,
  ];

  const all = features(data, options.object).filter((f) => options.filter?.(f) ?? true);

  const collection: FeatureCollection = { type: "FeatureCollection", features: all };

  const topology =
    data.type === "Topology"
      ? (() => {
          const key = options.object ?? Object.keys(data.objects)[0]!;
          const source = data.objects[key]!;

          if (source.type !== "GeometryCollection") return undefined;
          const read = feature(data, source);
          const list = "features" in read ? read.features : [read];
          // topojson-client turns a GeometryCollection into features in order, so geometry i is feature i.
          const kept = source.geometries.filter((_, i) => options.filter?.(list[i]!) ?? true);

          // SAFETY: topojson-client's merge and mesh read only each geometry's type and arcs, never its properties.
          return { data, geometries: kept as GeometryObject[] };
        })()
      : undefined;

  /**
   * The point behind the globe that the hidden side is folded around. It rides a parallel under the antipode of the
   * middle: the hidden pole when it stays hidden, else the parallel that clears every outline by the most, so nothing
   * passes close to it.
   */
  const pivot = (lines: readonly Strand[]): Pivot => {
    const lats = times.map((t) => facing(t)[1]);

    const segments = lines.flatMap((s) =>
      s.points.map((p, i) => {
        const q = s.points[(i + 1) % s.points.length]!;

        return [Math.asin(p[2]) / RAD, Math.asin(q[2]) / RAD] as const;
      }),
    );

    const clearance = (lat: number) =>
      segments.reduce(
        (m, [a, b]) =>
          Math.min(
            m,
            lat >= Math.min(a, b) && lat <= Math.max(a, b)
              ? 0
              : Math.min(Math.abs(lat - a), Math.abs(lat - b)),
          ),
        180,
      );

    const candidates = Array.from({ length: 361 }, (_, i) => -90 + i * 0.5)
      .map((lat) => ({
        lat,
        clear: clearance(lat),
        reach: Math.max(...lats.map((l) => Math.abs(lat + l))),
      }))
      .filter(({ reach, clear }) => reach <= REACH && clear >= 0.5)
      .sort(
        (a, b) =>
          Number(Math.abs(b.lat) === 90) - Number(Math.abs(a.lat) === 90) ||
          Math.min(b.clear, 3) - Math.min(a.clear, 3) ||
          a.reach - b.reach,
      );

    const best = candidates[0];

    if (!best)
      throw new Error(
        "globe() found no parallel behind the globe clear of every outline to fold the far side around. Tilt the globe further, simplify less, or filter out the shapes that cross every parallel.",
      );

    return { at: (t) => vec([facing(t)[0] + 180, best.lat]), lat: best.lat };
  };

  /** A point in the scene: true orthographic in front, folded out past the rim behind, around `hole`. */
  const place = (p: Vec3, v: View, hole: readonly [number, number]): [number, number] => {
    const [x, y, z] = [dot(p, v.right), dot(p, v.up), dot(p, v.toward)];

    if (z >= 0) return screen(x, y);
    const [sx, sy] = hole;
    let [ux, uy] = [x - sx, y - sy];
    const length = Math.hypot(ux, uy);

    if (length < 1e-12) [ux, uy] = [1, 0];
    else [ux, uy] = [ux / length, uy / length];
    const along = sx * ux + sy * uy;
    const reach = -along + Math.sqrt(Math.max(0, along * along - (sx * sx + sy * sy) + 1));
    const share = Math.min(1, length / reach);
    const out = 1 + BEYOND * (1 - share);

    return screen((sx + reach * ux) * out, (sy + reach * uy) * out);
  };

  /** A point folded out past the rim may stray half its distance past the rim, which keeps it out of sight. */
  const slack = (x: number, y: number) =>
    Math.max(0, (Math.hypot(x - center.x, y - center.y) - radius - 1) / 2);

  const turning = (sample: (t: Seconds) => string): Turning => {
    const animation = sampledPath(sample, { duration, tolerance, slack });

    // SAFETY: sample writes every frame starting with M.
    return { d: sample(0) as PathData, animation };
  };

  /** Signed area in the scene, to tell which way a ring runs. */
  const area = (ring: readonly (readonly [number, number])[]) =>
    ring.reduce((sum, [x, y], i) => {
      const [nx, ny] = ring[(i + 1) % ring.length]!;

      return sum + x * ny - nx * y;
    }, 0);

  /** Units whose middles share a band of longitude go in one path, so a path behind the globe holds still and costs no keys. */
  const pieces = (list: readonly Unit[]): Unit[][] => {
    const bands = new Map<number, Unit[]>();

    for (const unit of list) {
      const middle = unit.strands[0]!.points.reduce(add, ORIGIN);
      const band = Math.floor((Math.atan2(middle[1], middle[0]) / RAD + 180) / BAND);
      bands.set(band, [...(bands.get(band) ?? []), unit]);
    }

    return [...bands.keys()].sort((a, b) => a - b).map((band) => bands.get(band)!);
  };

  const path = (object: Outline): Turning[] => {
    const list = prepare(object, simplify, step);

    if (list.length === 0) throw new Error("globe() found no lines or rings to draw.");
    const hole = pivot(list.flatMap((unit) => unit.strands));

    return pieces(list).map((group) => {
      const strands = group.flatMap((unit) => unit.strands);
      const closed = strands.map((strand) => strand.closed);

      const rings = (t: Seconds) => {
        const v = view(t);
        const s = hole.at(t);
        const h = [dot(s, v.right), dot(s, v.up)] as const;

        return strands.map((strand) => strand.points.map((p) => place(p, v, h)));
      };

      const inside = group.some((unit) => unit.polygon && geoContains(unit.polygon, [0, hole.lat]));

      if (!inside) return turning((t) => write(rings(t), closed));

      // Folded around a point inside the area, a polygon fills its outside, so one ring past the fold turns it back.
      const sign = Math.sign(
        rings(0).reduce((sum, ring, i) => sum + (closed[i] ? area(ring) : 0), 0),
      );

      const around = ((1 + BEYOND) * 1.05) / Math.cos(Math.PI / 8);

      const octagon = Array.from({ length: 8 }, (_, i): [number, number] => {
        const a = (2 * Math.PI * i) / 8;

        return screen(around * Math.cos(a), around * Math.sin(a));
      });

      const outer = Math.sign(area(octagon)) === sign ? octagon.reverse() : octagon;

      return turning((t) => write([...rings(t), outer], [...closed, true]));
    });
  };

  /** A circle on the sphere, `axis` at its middle and `spread` radians out, from angle `start` to `end` measured from `zero`. */
  interface Arc {
    readonly axis: Vec3;
    readonly spread: number;
    readonly zero: Vec3;
    readonly start: number;
    readonly end: number;
  }

  /** Points along the part of an arc that faces the viewer. A hidden arc shrinks to the point where it will appear. */
  const visible = (arc: Arc, v: View, count: number): [number, number][] => {
    const side = cross(arc.axis, arc.zero);

    const at = (theta: number) =>
      add(
        scale(arc.axis, Math.cos(arc.spread)),
        scale(
          add(scale(arc.zero, Math.cos(theta)), scale(side, Math.sin(theta))),
          Math.sin(arc.spread),
        ),
      );

    const a = Math.cos(arc.spread) * dot(arc.axis, v.toward);
    const b = Math.sin(arc.spread) * dot(arc.zero, v.toward);
    const c = Math.sin(arc.spread) * dot(side, v.toward);
    const m = Math.hypot(b, c);
    const peak = Math.atan2(c, b);
    const full = arc.end - arc.start >= 2 * Math.PI - 1e-9;
    const half = m < 1e-12 ? (a >= 0 ? Math.PI : 0) : Math.acos(Math.max(-1, Math.min(1, -a / m)));
    let lo: number;
    let hi: number;

    if (full)
      [lo, hi] = half >= Math.PI ? [peak - Math.PI, peak + Math.PI] : [peak - half, peak + half];
    else {
      const middle = (arc.start + arc.end) / 2;
      const near = peak + 2 * Math.PI * Math.round((middle - peak) / (2 * Math.PI));
      [lo, hi] = [Math.max(arc.start, near - half), Math.min(arc.end, near + half)];

      if (lo > hi) lo = hi = near - half > arc.end ? arc.end : arc.start;
    }

    if (hi - lo < 1e-9) lo = hi = full ? peak : lo;

    return Array.from({ length: count }, (_, i) => {
      const p = at(lo + ((hi - lo) * i) / (count - 1));
      const [x, y, z] = [dot(p, v.right), dot(p, v.up), dot(p, v.toward)];
      const r = z >= 0 ? 1 : Math.hypot(x, y) || 1;

      return screen(x / r, y / r);
    });
  };

  /** One arc as a turning line, a point every 3 degrees of its length. */
  const arcs = (arcAt: (t: Seconds) => Arc): Turning => {
    const first = arcAt(0);
    const count = Math.max(2, Math.ceil((first.end - first.start) / (3 * RAD)) + 1);

    return turning((t) => write([visible(arcAt(t), view(t), count)], [false]));
  };

  const perpendicular = (axis: Vec3): Vec3 =>
    unit(cross(axis, Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));

  const circleArc = (axis: Vec3, spread: number): Arc => ({
    axis,
    spread,
    zero: perpendicular(axis),
    start: 0,
    end: 2 * Math.PI,
  });

  const dated = (date: Date | ((t: Seconds) => Date)) => (t: Seconds) => {
    const [lon, lat] = sun(date instanceof Date ? date : date(t));

    return vec([lon + 180, -lat]);
  };

  return {
    center,
    radius,
    duration,
    sphere: `M${fmt(center.x - radius)} ${fmt(center.y)}a${fmt(radius)} ${fmt(radius)} 0 1 0 ${fmt(2 * radius)} 0a${fmt(radius)} ${fmt(radius)} 0 1 0 ${fmt(-2 * radius)} 0Z`,
    facing,
    locate(at, t) {
      const v = view(t);
      const p = vec(at);
      const [x, y] = screen(dot(p, v.right), dot(p, v.up));

      return { point: { x, y }, z: dot(p, v.toward) };
    },
    land() {
      if (!topology) return path(collection);

      return path(
        merge(
          topology.data,
          topology.geometries.filter(
            (g): g is Polygon | MultiPolygon => g.type === "Polygon" || g.type === "MultiPolygon",
          ),
        ),
      );
    },
    borders() {
      if (!topology)
        throw new Error(
          "globe().borders() needs TopoJSON, which knows which edges two regions share.",
        );

      return path(
        mesh(
          topology.data,
          { type: "GeometryCollection", geometries: topology.geometries },
          (a, b) => a !== b,
        ),
      );
    },
    path,
    graticule(gap = 15) {
      const meridians = Array.from({ length: Math.round(360 / gap) }, (_, i): Arc => {
        const lon = -180 + i * gap;

        return {
          axis: vec([lon + 90, 0]),
          spread: Math.PI / 2,
          zero: vec([lon, 0]),
          start: -Math.PI / 2,
          end: Math.PI / 2,
        };
      });

      const parallels = Array.from({ length: Math.round(180 / gap) - 1 }, (_, i): Arc => ({
        axis: [0, 0, 1],
        spread: (90 - (-90 + (i + 1) * gap)) * RAD,
        zero: [1, 0, 0],
        start: 0,
        end: 2 * Math.PI,
      }));

      const list = [...meridians, ...parallels];

      return list.map((arc) => arcs(() => arc));
    },
    circle(at, spread) {
      const arc = circleArc(vec(at), spread * RAD);

      return arcs(() => arc);
    },
    route(from, to) {
      const [a, b] = [vec(from), vec(to)];
      const axis = unit(cross(a, b));

      const arc: Arc = { axis, spread: Math.PI / 2, zero: a, start: 0, end: angle(a, b) };

      return arcs(() => arc);
    },
    terminator(date) {
      const dark = dated(date);

      return arcs((t) => circleArc(dark(t), Math.PI / 2));
    },
    night(date) {
      const dark = dated(date);
      const count = 49;

      return turning((t) => {
        const v = view(t);
        const d = dark(t);
        const n: Vec3 = [dot(d, v.right), dot(d, v.up), dot(d, v.toward)];
        const flat = Math.hypot(n[0], n[1]);
        const a: Vec3 = flat < 1e-9 ? [1, 0, 0] : [n[1] / flat, -n[0] / flat, 0];
        let b = cross(n, a);

        if (b[2] < 0) b = scale(b, -1);
        let c: Vec3 = [-a[1], a[0], 0];
        const facing = dot(c, n);
        const bulge = c[0] * b[0] + c[1] * b[1];

        if (Math.abs(facing) > 1e-9 ? facing < 0 : n[2] >= 0 ? bulge > 0 : bulge < 0)
          c = scale(c, -1);

        const edge = Array.from({ length: count }, (_, i) => {
          const theta = (Math.PI * i) / (count - 1);
          const p = add(scale(a, Math.cos(theta)), scale(b, Math.sin(theta)));

          return screen(p[0], p[1]);
        });

        const rim = Array.from({ length: count - 2 }, (_, i) => {
          const theta = Math.PI - (Math.PI * (i + 1)) / (count - 1);
          const p = add(scale(a, Math.cos(theta)), scale(c, Math.sin(theta)));

          return screen(p[0], p[1]);
        });

        return write([[...edge, ...rim]], [true]);
      });
    },
    place(at, { fade = 0.08 } = {}) {
      const p = vec(at);

      return {
        animation: sampled(
          (t) => {
            const v = view(t);
            const [x, y] = screen(dot(p, v.right), dot(p, v.up));

            return { x, y, opacity: Math.min(1, Math.max(0, dot(p, v.toward) / fade)) };
          },
          { duration, tolerance: { translate: tolerance, opacity: 0.02 } },
        ),
      };
    },
  };
}
