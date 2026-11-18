/** @jsxImportSource svjeez */
import { geoContains } from "d3-geo";
import type { GeoJsonProperties } from "geojson";
import {
  Group,
  Shape,
  circle,
  ease,
  path,
  pathData,
  sampled,
  span,
  track,
  type Anim,
  type Geometry,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { SceneError, type ShapeProps } from "svjeez/tools";
import {
  finder,
  lonLat,
  positive,
  read,
  type GeoData,
  type LonLat,
  type ReadOptions,
} from "./data.ts";
import { rings } from "./outline.ts";
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
import { sun } from "./sun.ts";

export interface Turn {
  readonly by: number;
  readonly over: Span;
}

export interface GlobeOptions extends ReadOptions {
  readonly radius: number;
  readonly facing: LonLat;
  readonly turn?: Turn;
  readonly simplify?: number;
  readonly step?: number;
  readonly tolerance?: number;
}

export interface Turning {
  readonly what: string;
  readonly radius: number;
  readonly pieces: readonly Anim<Geometry>[];
}

export interface Riding {
  readonly at: Anim<Vec>;
  readonly opacity: Anim<number>;
}

export interface GlobeRegion {
  readonly id: string;
  readonly name: string | undefined;
  readonly properties: GeoJsonProperties;
  readonly outline: Turning;
}

export type Dated = Date | ((t: number) => Date);

export interface Globe {
  readonly radius: number;
  readonly sphere: Geometry;
  readonly land: Turning;
  readonly borders: Turning;
  readonly regions: readonly GlobeRegion[];
  region(key: string | number): GlobeRegion;
  shape(object: Outline): Turning;
  graticule(step?: number): Turning;
  circle(center: LonLat, degrees: number): Turning;
  route(from: LonLat, to: LonLat): Turning;
  night(date: Dated): Turning;
  terminator(date: Dated): Turning;
  place(at: LonLat, options?: { readonly fade?: number }): Riding;
  facing(t: number): LonLat;
  locate(at: LonLat, t: number): { readonly point: Vec; readonly z: number };
}

interface View {
  readonly right: Vec3;
  readonly up: Vec3;
  readonly toward: Vec3;
}

interface Pivot {
  readonly at: (t: number) => Vec3;
  readonly lat: number;
}

interface Arc {
  readonly axis: Vec3;
  readonly spread: number;
  readonly zero: Vec3;
  readonly start: number;
  readonly end: number;
}

type Ring = readonly (readonly [number, number])[];

const BEYOND = 1;

const REACH = 80;

const SAMPLE = 0.05;

const BAND = 30;

const viewOf = ([lon, lat]: LonLat): View => {
  const [l, p] = [lon * RAD, lat * RAD];

  return {
    right: [-Math.sin(l), Math.cos(l), 0],
    up: [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)],
    toward: vec([lon, lat]),
  };
};

const area = (ring: Ring) =>
  ring.reduce((sum, [x, y], i) => {
    const [nx, ny] = ring[(i + 1) % ring.length]!;

    return sum + x * ny - nx * y;
  }, 0);

const perpendicular = (axis: Vec3): Vec3 =>
  unit(cross(axis, Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));

const circleArc = (axis: Vec3, spread: number): Arc => ({
  axis,
  spread,
  zero: perpendicular(axis),
  start: 0,
  end: 2 * Math.PI,
});

const KAPPA = 0.5522847498;

const disc = (r: number): Geometry => {
  const k = r * KAPPA;

  return path()
    .moveTo([r, 0])
    .curveTo([r, k], [k, r], [0, r])
    .curveTo([-k, r], [-r, k], [-r, 0])
    .curveTo([-r, -k], [-k, -r], [0, -r])
    .curveTo([k, -r], [r, -k], [r, 0])
    .close();
};

const made = (what: string, radius: number, pieces: readonly Anim<Geometry>[]): Turning => ({
  what,
  radius,
  pieces,
});

export function globe(data: GeoData, options: GlobeOptions): Globe {
  const { simplify = 0.6, step = 6, tolerance = 1, turn } = options;

  const radius = positive(
    options.radius,
    "globe()'s radius",
    "Give the globe's radius in px, such as 200.",
  );

  const [lon0, lat0] = lonLat(options.facing ?? [NaN, NaN], "globe()'s facing");
  positive(step, "globe()'s step", "Give the most degrees between two points, such as 6.");
  positive(tolerance, "globe()'s tolerance", "Give the px a turning outline may stray, such as 1.");

  if (!(simplify >= 0))
    throw new SceneError(
      `globe()'s simplify needs 0 or more degrees, got ${simplify}.`,
      "Give the degrees an outline may stray, such as 0.6.",
    );

  if (turn !== undefined) {
    if (!Number.isFinite(turn.by))
      throw new SceneError(
        `globe()'s turn needs a finite number of degrees, got ${turn.by}.`,
        "Write turn: { by: -360, over: span(0, 24) } for one day, west to east.",
      );

    if (!(turn.over && turn.over.over > 0 && Number.isFinite(turn.over.start)))
      throw new SceneError(
        "globe()'s turn needs a span that lasts longer than 0.",
        "Write turn: { by: -360, over: span(0, 24) }.",
      );
  }

  const over = turn?.over.over ?? 0;

  const facing = (t: number): LonLat => [
    lon0 + (turn ? turn.by * Math.min(1, Math.max(0, t / over)) : 0),
    lat0,
  ];

  const times = turn
    ? Array.from({ length: Math.ceil(over / SAMPLE) + 1 }, (_, i) => Math.min(over, i * SAMPLE))
    : [0];

  const views = new Map<number, View>();

  const view = (t: number) => {
    let found = views.get(t);

    if (!found) views.set(t, (found = viewOf(facing(t))));

    return found;
  };

  const screen = (x: number, y: number): [number, number] => [radius * x, -radius * y];
  const source = read(data, options, "globe()");

  const fit = (sample: (t: number) => string): Anim<Geometry> => {
    const frames = times.map(sample);

    if (!turn) return pathData(frames[0]!);
    const values = frames.map((d) => d.match(/-?[\d.]+/g)!.map(Number));

    const room = values.map((v) =>
      Float64Array.from({ length: v.length >> 1 }, (_, k) =>
        Math.max(0, (Math.hypot(v[2 * k]!, v[2 * k + 1]!) - radius - 1) / 2),
      ),
    );

    const miss = (a: number, b: number, i: number) => {
      const u = (times[i]! - times[a]!) / (times[b]! - times[a]!);
      let worst = 0;

      for (let k = 0; k + 1 < values[i]!.length; k += 2) {
        const x = values[a]![k]! + (values[b]![k]! - values[a]![k]!) * u - values[i]![k]!;

        const y =
          values[a]![k + 1]! + (values[b]![k + 1]! - values[a]![k + 1]!) * u - values[i]![k + 1]!;

        worst = Math.max(worst, Math.hypot(x, y) - room[i]![k >> 1]!);
      }

      return worst;
    };

    const kept = [0, frames.length - 1];

    const divide = (a: number, b: number): void => {
      let worst = -1;
      let error = tolerance;

      for (let i = a + 1; i < b; i++) {
        const m = miss(a, b, i);

        if (m > error) [worst, error] = [i, m];
      }

      if (worst < 0) return;
      kept.push(worst);
      divide(a, worst);
      divide(worst, b);
    };

    divide(0, frames.length - 1);
    kept.sort((a, b) => a - b);
    const start = turn.over.start;
    let out = track<Geometry>(pathData(frames[0]!));

    for (let j = 1; j < kept.length; j++) {
      const [a, b] = [kept[j - 1]!, kept[j]!];
      out = out.to(
        pathData(frames[b]!),
        span(start + times[a]!, times[b]! - times[a]!),
        ease.linear,
      );
    }

    return out;
  };

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

    const best = Array.from({ length: 361 }, (_, i) => -90 + i * 0.5)
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
      )[0];

    if (!best)
      throw new SceneError(
        "globe() found no parallel behind the globe clear of every outline to fold the far side around.",
        "Tilt the globe further with facing, raise simplify, or filter out the shapes that cross every parallel.",
      );

    return { at: (t) => vec([facing(t)[0] + 180, best.lat]), lat: best.lat };
  };

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

  const bands = (list: readonly Unit[]): Unit[][] => {
    const found = new Map<number, Unit[]>();

    for (const one of list) {
      const middle = one.strands[0]!.points.reduce(add, ORIGIN);
      const band = Math.floor((Math.atan2(middle[1], middle[0]) / RAD + 180) / BAND);
      found.set(band, [...(found.get(band) ?? []), one]);
    }

    return [...found.keys()].sort((a, b) => a - b).map((band) => found.get(band)!);
  };

  const outline = (object: Outline, what: string): Turning => {
    const list = prepare(object, simplify, step);

    if (list.length === 0)
      throw new SceneError(
        `globe() found no lines or rings to draw in ${what}.`,
        "Pass GeoJSON with a line or a polygon larger than simplify.",
      );
    const hole = pivot(list.flatMap((one) => one.strands));

    const pieces = bands(list).map((group) => {
      const strands = group.flatMap((one) => one.strands);
      const closed = strands.map((strand) => strand.closed);

      const placed = (t: number) => {
        const v = view(t);
        const s = hole.at(t);
        const h = [dot(s, v.right), dot(s, v.up)] as const;

        return strands.map((strand) => strand.points.map((p) => place(p, v, h)));
      };

      const inside = group.some((one) => one.polygon && geoContains(one.polygon, [0, hole.lat]));

      if (!inside) return fit((t) => rings(placed(t), closed));

      const sign = Math.sign(
        placed(0).reduce((sum, ring, i) => sum + (closed[i] ? area(ring) : 0), 0),
      );

      const around = ((1 + BEYOND) * 1.05) / Math.cos(Math.PI / 8);

      const octagon = Array.from({ length: 8 }, (_, i): [number, number] => {
        const a = (2 * Math.PI * i) / 8;

        return screen(around * Math.cos(a), around * Math.sin(a));
      });

      const outer = Math.sign(area(octagon)) === sign ? octagon.reverse() : octagon;

      return fit((t) => rings([...placed(t), outer], [...closed, true]));
    });

    return made(what, radius, pieces);
  };

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

  const arcs = (list: readonly ((t: number) => Arc)[], what: string): Turning => {
    const counts = list.map((arcAt) => {
      const first = arcAt(0);

      return Math.max(2, Math.ceil((first.end - first.start) / (3 * RAD)) + 1);
    });

    const open = list.map(() => false);

    return made(what, radius, [
      fit((t) =>
        rings(
          list.map((arcAt, i) => visible(arcAt(t), view(t), counts[i]!)),
          open,
        ),
      ),
    ]);
  };

  const dated = (date: Dated, caller: string) => {
    const at = (t: number): Date => {
      const found = date instanceof Date ? date : date(t);

      if (!(found instanceof Date) || !Number.isFinite(found.getTime()))
        throw new SceneError(
          `${caller} needs a Date, or a function from seconds to a Date, and got ${String(found)}.`,
          "Pass new Date(Date.UTC(2026, 5, 21)), or (t) => new Date(start + t * 3_600_000).",
        );

      return found;
    };

    return (t: number) => {
      const [lon, lat] = sun(at(t));

      return vec([lon + 180, -lat]);
    };
  };

  const regions = source.places.map((one): GlobeRegion => ({
    id: one.id,
    name: one.name,
    properties: one.properties,
    get outline() {
      return outline(one.feature, `the region ${JSON.stringify(one.name ?? one.id)}`);
    },
  }));

  const find = finder(regions, "globe()");

  return {
    radius,
    sphere: disc(radius),
    get land() {
      return outline(source.land, "the globe's land");
    },
    get borders() {
      if (!source.borders)
        throw new SceneError(
          "globe() reads borders only from TopoJSON, which knows which edges two regions share, and this data is GeoJSON.",
          "Load TopoJSON, such as world-atlas's countries-110m.json.",
        );

      return outline(source.borders, "the globe's borders");
    },
    regions,
    region: find,
    shape: (object) => outline(object, "shape()"),
    graticule(every = 15) {
      positive(every, "graticule()", "Give the degrees between lines, such as 15.");
      const count = Math.round(180 / every);

      const meridians = Array.from({ length: 2 * count }, (_, i): Arc => {
        const l = (i * every - 180) * RAD;

        return {
          axis: [-Math.sin(l), Math.cos(l), 0],
          spread: Math.PI / 2,
          zero: [0, 0, -1],
          start: 0,
          end: Math.PI,
        };
      });

      const parallels = Array.from({ length: count - 1 }, (_, i): Arc => ({
        axis: [0, 0, 1],
        spread: Math.PI / 2 - (-90 + (i + 1) * every) * RAD,
        zero: [1, 0, 0],
        start: 0,
        end: 2 * Math.PI,
      }));

      return arcs(
        [...meridians, ...parallels].map((arc) => () => arc),
        "graticule()",
      );
    },
    circle(at, degrees) {
      positive(degrees, "circle()", "Give the circle's radius in degrees, such as 10.");
      const arc = circleArc(vec(lonLat(at, "circle()")), degrees * RAD);

      return arcs([() => arc], "circle()");
    },
    route(from, to) {
      const [a, b] = [vec(lonLat(from, "route()")), vec(lonLat(to, "route()"))];

      if (angle(a, b) < 1e-9)
        throw new SceneError(
          `route([${from.join(", ")}], [${to.join(", ")}]) starts where it ends.`,
          "Give two different places.",
        );

      const arc: Arc = {
        axis: unit(cross(a, b)),
        spread: Math.PI / 2,
        zero: a,
        start: 0,
        end: angle(a, b),
      };

      return arcs([() => arc], "route()");
    },
    terminator(date) {
      const dark = dated(date, "terminator()");

      return arcs([(t) => circleArc(dark(t), Math.PI / 2)], "terminator()");
    },
    night(date) {
      const dark = dated(date, "night()");
      const count = 49;

      const sample = (t: number) => {
        const v = view(t);
        const d = dark(t);
        const n: Vec3 = [dot(d, v.right), dot(d, v.up), dot(d, v.toward)];
        const flat = Math.hypot(n[0], n[1]);
        const a: Vec3 = flat < 1e-9 ? [1, 0, 0] : [n[1] / flat, -n[0] / flat, 0];
        let b = cross(n, a);

        if (b[2] < 0) b = scale(b, -1);
        let c: Vec3 = [-a[1], a[0], 0];
        const toward = dot(c, n);
        const bulge = c[0] * b[0] + c[1] * b[1];

        if (Math.abs(toward) > 1e-9 ? toward < 0 : n[2] >= 0 ? bulge > 0 : bulge < 0)
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

        return rings([[...edge, ...rim]], [true]);
      };

      return made("night()", radius, [fit(sample)]);
    },
    place(at, { fade = 0.08 } = {}) {
      const p = vec(lonLat(at, "place()"));
      positive(fade, "place()'s fade", "Give the share of the radius to fade over, such as 0.08.");

      const where = (t: number): Vec => {
        const v = view(t);
        const [x, y] = screen(dot(p, v.right), dot(p, v.up));

        return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
      };

      const shown = (t: number) => Math.min(1, Math.max(0, dot(p, view(t).toward) / fade));

      if (!turn) return { at: where(0), opacity: shown(0) };
      const seen = times.filter((t) => shown(t) > 0);

      const held = (t: number): Vec => {
        if (shown(t) > 0 || seen.length === 0) return where(t);

        return where(seen.find((s) => s >= t) ?? seen.findLast((s) => s <= t)!);
      };

      return {
        at: sampled(held, turn.over, { tolerance }),
        opacity: sampled(shown, turn.over, { tolerance: 0.02 }),
      };
    },
    facing,
    locate(at, t) {
      const v = view(t);
      const p = vec(lonLat(at, "locate()"));
      const [x, y] = screen(dot(p, v.right), dot(p, v.up));

      return { point: [x, y], z: dot(p, v.toward) };
    },
  };
}

export interface GlobeShapeProps extends Omit<ShapeProps, "geometry" | "clip"> {
  readonly of: Turning;
}

export const GlobeShape = ({ of, fill, stroke, trim, ...rest }: GlobeShapeProps): SceneElement => {
  if (!of || !Array.isArray(of.pieces))
    throw new SceneError(
      `<GlobeShape> takes of={…} from a globe, such as of={earth.land}, got ${String(of)}.`,
      "Pass what a globe() returns: land, borders, region(…).outline, route(…), night(…).",
    );

  if (fill === undefined && stroke === undefined)
    throw new SceneError(
      `<GlobeShape> of ${of.what} paints nothing: it has no fill and no stroke.`,
      "Give it fill or stroke.",
    );

  const paint = {
    ...(fill !== undefined && { fill }),
    ...(stroke !== undefined && { stroke }),
    ...(trim !== undefined && { trim }),
  };

  return (
    <Group {...rest} clip={circle(of.radius)}>
      {of.pieces.map((geometry, i) => (
        <Shape key={String(i)} geometry={geometry} {...paint} />
      ))}
    </Group>
  );
};
