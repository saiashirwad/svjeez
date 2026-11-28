/** @jsxImportSource svjeez */
import { geoContains } from "d3-geo";
import type { GeoJsonProperties } from "geojson";
import {
  Group,
  Shape,
  circle,
  ease,
  path,
  sampled,
  span,
  track,
  type Anim,
  type Geometry,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { SceneError, easeAt, type Ease, type ShapeProps } from "svjeez/tools";
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
  slerp,
  coarsen,
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

/** Where the globe sits on its canvas: its centre, in canvas px, and the canvas's size. */
export interface Canvas {
  readonly size: Vec;
  readonly center: Vec;
}

export interface GlobeOptions extends ReadOptions {
  readonly radius: number;
  readonly facing: LonLat;
  /** Degrees the whole globe leans on the screen, clockwise; its north then points up and to the right. */
  readonly lean?: number;
  /** Where the globe sits on the canvas, so outlines that never reach it are not emitted. */
  readonly canvas?: Canvas;
  /** With a canvas: the degrees an outline may stray where it never reaches the canvas. Default 3. */
  readonly offscreen?: number;
  readonly turn?: Turn;
  readonly simplify?: number;
  readonly step?: number;
  readonly tolerance?: number;
}

export interface Turning {
  readonly what: string;
  readonly radius: number;
  readonly pieces: readonly Anim<Geometry>[];
  /** One name per piece, such as "land-30E-60E": what `svjeez check` calls it. */
  readonly keys: readonly string[];
}

export interface RideOptions {
  /** Also turn to the route's heading on the screen (degrees; 0 faces +x). */
  readonly turn?: boolean;
  /** The seconds to follow the globe over; the turn's own span by default. */
  readonly over?: Span;
  /** Reshapes the share of the route flown, 0 to 1: `ease.inOut`, or a function such as `(u) => u * u`. Steady by default. */
  readonly ease?: Ease | ((share: number) => number);
  /** The share of the radius, past the horizon, over which the rider fades out. Default 0.08. */
  readonly fade?: number;
}

/** A motion layer: `<Group motion={earth.ride(…)}>`, in the globe's own space. */
export interface Rider {
  readonly offset: Anim<Vec>;
  readonly rotate?: Anim<number>;
  readonly opacity: Anim<number>;
}

export interface Riding {
  readonly offset: Anim<Vec>;
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
  ride(from: LonLat, to: LonLat, progress: Span, options?: RideOptions): Rider;
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

/** The most, in radians, an edge folded out past the rim may swing around the globe. */
const FOLD = 8 * RAD;

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

/** A piece and the box, [x0, y0, x1, y1] from the globe's centre, it reaches over the whole turn. */
interface Fitted {
  readonly geometry: Anim<Geometry>;
  readonly reach: readonly [number, number, number, number];
  readonly key: string;
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const lonName = (lon: number) => `${Math.abs(lon)}${lon < 0 ? "W" : lon > 0 ? "E" : ""}`;

export function globe(data: GeoData, options: GlobeOptions): Globe {
  const {
    simplify = 0.6,
    step = 6,
    tolerance = 1,
    turn,
    lean = 0,
    canvas,
    offscreen = 3,
  } = options;

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

  const [lc, ls] = [Math.cos(lean * RAD), Math.sin(lean * RAD)];

  const screen = (x: number, y: number): [number, number] => [
    radius * (x * lc + y * ls),
    radius * (x * ls - y * lc),
  ];

  const frame: readonly [number, number, number, number] | undefined = canvas && [
    -canvas.center[0],
    -canvas.center[1],
    canvas.size[0] - canvas.center[0],
    canvas.size[1] - canvas.center[1],
  ];

  const watching = times.filter((_, i) => i % 10 === 0 || i === times.length - 1);

  const made = (what: string, pieces: readonly Fitted[]): Turning => {
    const seen = pieces.filter(({ reach: [x0, y0, x1, y1] }) => {
      if (!frame) return true;

      return (
        x1 > frame[0] + 0.5 && y1 > frame[1] + 0.5 && x0 < frame[2] - 0.5 && y0 < frame[3] - 0.5
      );
    });

    return {
      what,
      radius,
      pieces: seen.map((one) => one.geometry),
      keys: seen.map((one) => one.key),
    };
  };

  const source = read(data, options, "globe()");

  const fit = (sample: (t: number) => string, key: string, slack = 1): Fitted => {
    const frames = times.map(sample);
    const values = frames.map((d) => d.match(/-?[\d.]+/g)!.map(Number));
    const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];

    for (const v of values)
      for (let k = 0; k + 1 < v.length; k += 2) {
        box[0] = Math.min(box[0], v[k]!);
        box[1] = Math.min(box[1], v[k + 1]!);
        box[2] = Math.max(box[2], v[k]!);
        box[3] = Math.max(box[3], v[k + 1]!);
      }

    // Anything past the disc is clipped away, so only the part inside it can reach the canvas.
    const reach: [number, number, number, number] = [
      Math.max(box[0], -radius),
      Math.max(box[1], -radius),
      Math.min(box[2], radius),
      Math.min(box[3], radius),
    ];

    return { geometry: fitted(frames, values, tolerance * slack), reach, key };
  };

  const fitted = (frames: string[], values: number[][], tolerance: number): Anim<Geometry> => {
    if (!turn) return path.parse(frames[0]!);

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
    let out = track<Geometry>(path.parse(frames[0]!));

    for (let j = 1; j < kept.length; j++) {
      const [a, b] = [kept[j - 1]!, kept[j]!];
      out = out.to(
        path.parse(frames[b]!),
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

  // The far side is folded out past the rim around the hole, so a short edge near the hole can
  // swing far around the globe and its straight chord then cuts across the disc. Split edges
  // until no chord past the rim sinks more than the tolerance into the disc, at any moment of
  // the turn, and the same way at every moment so the frames still line up.
  const fold = Math.min(FOLD, 2 * Math.acos(Math.max(0, 1 - tolerance / radius)));

  const folded = (hole: Pivot) => {
    const moments = times.map((t) => {
      const v = view(t);
      const s = hole.at(t);

      return { v, h: [dot(s, v.right), dot(s, v.up)] as const };
    });

    const sweep = (a: Vec3, b: Vec3) =>
      moments.reduce((most, { v, h }) => {
        if (dot(a, v.toward) >= 0 && dot(b, v.toward) >= 0) return most;
        const [ax, ay] = place(a, v, h);
        const [bx, by] = place(b, v, h);

        return Math.max(most, Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by)));
      }, 0);

    const split = (a: Vec3, b: Vec3, depth: number, out: Vec3[]): void => {
      if (depth < 16 && angle(a, b) > 1e-5 && sweep(a, b) > fold) {
        const middle = slerp(a, b, 0.5);
        split(a, middle, depth + 1, out);
        split(middle, b, depth + 1, out);
      } else out.push(b);
    };

    return (strand: Strand): Strand => {
      const { points, closed } = strand;
      const out: Vec3[] = [points[0]!];

      for (let i = 1; i < points.length + (closed ? 1 : 0); i++)
        split(points[i - 1]!, points[i % points.length]!, 0, out);

      if (closed) out.pop();

      return { points: out, closed };
    };
  };

  const bands = (list: readonly Unit[]): [number, Unit[]][] => {
    const found = new Map<number, Unit[]>();

    for (const one of list) {
      const middle = one.strands[0]!.points.reduce(add, ORIGIN);
      const band = Math.floor((Math.atan2(middle[1], middle[0]) / RAD + 180) / BAND);
      found.set(band, [...(found.get(band) ?? []), one]);
    }

    return [...found.keys()].sort((a, b) => a - b).map((band) => [band, found.get(band)!]);
  };

  const seen = (p: Vec3): boolean =>
    !frame ||
    watching.some((t) => {
      const v = view(t);

      if (dot(p, v.toward) < -0.2) return false;
      const [x, y] = screen(dot(p, v.right), dot(p, v.up));

      return x > frame[0] - 80 && x < frame[2] + 80 && y > frame[1] - 80 && y < frame[3] + 80;
    });

  const outline = (object: Outline, what: string, name: string): Turning => {
    const list = prepare(object, simplify, step).map((one) => ({
      ...one,
      strands: frame
        ? one.strands.map((strand) => coarsen(strand, strand.points.map(seen), offscreen))
        : one.strands,
    }));

    if (list.length === 0)
      throw new SceneError(
        `globe() found no lines or rings to draw in ${what}.`,
        "Pass GeoJSON with a line or a polygon larger than simplify.",
      );
    const hole = pivot(list.flatMap((one) => one.strands));
    const fine = folded(hole);

    const all = bands(list);

    const pieces = all.map(([band, group]) => {
      const lo = band * BAND - 180;
      const key = all.length === 1 ? name : `${name}-${lonName(lo)}-${lonName(lo + BAND)}`;
      const strands = group.flatMap((one) => one.strands).map(fine);
      const closed = strands.map((strand) => strand.closed);

      const placed = (t: number) => {
        const v = view(t);
        const s = hole.at(t);
        const h = [dot(s, v.right), dot(s, v.up)] as const;

        return strands.map((strand) => strand.points.map((p) => place(p, v, h)));
      };

      const inside = group.some((one) => one.polygon && geoContains(one.polygon, [0, hole.lat]));

      if (!inside) return fit((t) => rings(placed(t), closed), key);

      const sign = Math.sign(
        placed(0).reduce((sum, ring, i) => sum + (closed[i] ? area(ring) : 0), 0),
      );

      const around = ((1 + BEYOND) * 1.05) / Math.cos(Math.PI / 8);

      const octagon = Array.from({ length: 8 }, (_, i): [number, number] => {
        const a = (2 * Math.PI * i) / 8;

        return screen(around * Math.cos(a), around * Math.sin(a));
      });

      const outer = Math.sign(area(octagon)) === sign ? octagon.reverse() : octagon;

      return fit((t) => rings([...placed(t), outer], [...closed, true]), key);
    });

    return made(what, pieces);
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

  const arcs = (
    all: readonly ((t: number) => Arc)[],
    what: string,
    name: string,
    slack = 1,
  ): Turning => {
    const counts = all.map((arcAt) => {
      const first = arcAt(0);

      return Math.max(2, Math.ceil((first.end - first.start) / (step * RAD)) + 1);
    });

    // A line that never comes near the canvas is not drawn.
    const near = all.flatMap((arcAt, i) =>
      !frame ||
      watching.some((t) =>
        visible(arcAt(t), view(t), counts[i]!).some(
          ([x, y]) =>
            x > frame[0] - 80 && x < frame[2] + 80 && y > frame[1] - 80 && y < frame[3] + 80,
        ),
      )
        ? [i]
        : [],
    );

    if (near.length === 0) return made(what, []);

    return made(what, [
      fit(
        (t) =>
          rings(
            near.map((i) => visible(all[i]!(t), view(t), counts[i]!)),
            near.map(() => false),
          ),
        name,
        slack,
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
      return outline(
        one.feature,
        `the region ${JSON.stringify(one.name ?? one.id)}`,
        slug(one.name ?? one.id),
      );
    },
  }));

  const find = finder(regions, "globe()");

  return {
    radius,
    sphere: disc(radius),
    get land() {
      return outline(source.land, "the globe's land", "land");
    },
    get borders() {
      if (!source.borders)
        throw new SceneError(
          "globe() reads borders only from TopoJSON, which knows which edges two regions share, and this data is GeoJSON.",
          "Load TopoJSON, such as world-atlas's countries-110m.json.",
        );

      return outline(source.borders, "the globe's borders", "borders");
    },
    regions,
    region: find,
    shape: (object) => outline(object, "shape()", "shape"),
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
        "graticule",
        3,
      );
    },
    circle(at, degrees) {
      positive(degrees, "circle()", "Give the circle's radius in degrees, such as 10.");
      const arc = circleArc(vec(lonLat(at, "circle()")), degrees * RAD);

      return arcs([() => arc], "circle()", "circle");
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

      return arcs([() => arc], "route()", "route");
    },
    ride(
      from,
      to,
      progress,
      { turn: heading = false, over: window, fade = 0.08, ease: curve = (u: number) => u } = {},
    ) {
      const [a, b] = [vec(lonLat(from, "ride()")), vec(lonLat(to, "ride()"))];

      if (angle(a, b) < 1e-9)
        throw new SceneError(
          `ride([${from.join(", ")}], [${to.join(", ")}]) starts where it ends.`,
          "Give two different places.",
        );

      positive(fade, "ride()'s fade", "Give the share of the radius to fade over, such as 0.08.");
      const span = window ?? turn?.over;

      if (!span)
        throw new SceneError(
          "ride() on a globe that does not turn needs the seconds to follow, as over.",
          "Write ride(from, to, progress, { over: span(0, 8) }).",
        );

      const shape = curve instanceof Function ? curve : (u: number) => easeAt(curve, u);

      const share = (t: number) =>
        Math.min(1, Math.max(0, shape((t - progress.start) / progress.over)));

      const at = (s: number, t: number) => {
        const [p, v] = [slerp(a, b, s), view(t)];

        return screen(dot(p, v.right), dot(p, v.up));
      };

      const first = (() => {
        const [x, y] = at(0.5, span.start);
        const [x2, y2] = at(0.51, span.start);

        return Math.atan2(y2 - y, x2 - x) / RAD;
      })();

      const course = (t: number) => {
        const s = share(t);
        const [x0, y0] = at(Math.max(0, s - 0.01), t);
        const [x1, y1] = at(Math.min(1, s + 0.01), t);
        const h = Math.atan2(y1 - y0, x1 - x0) / RAD;

        return first + ((((h - first) % 360) + 540) % 360) - 180;
      };

      const shown = (t: number) =>
        Math.min(1, Math.max(0, dot(slerp(a, b, share(t)), view(t).toward) / fade));

      return {
        offset: sampled((t) => at(share(t), t), span, { tolerance }),
        ...(heading && { rotate: sampled(course, span, { tolerance: 0.5 }) }),
        opacity: sampled(shown, span, { tolerance: 0.02 }),
      };
    },
    terminator(date) {
      const dark = dated(date, "terminator()");

      return arcs([(t) => circleArc(dark(t), Math.PI / 2)], "terminator()", "terminator");
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

      return made("night()", [fit(sample, "night")]);
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

      if (!turn) return { offset: where(0), opacity: shown(0) };
      const seen = times.filter((t) => shown(t) > 0);

      const held = (t: number): Vec => {
        if (shown(t) > 0 || seen.length === 0) return where(t);

        return where(seen.find((s) => s >= t) ?? seen.findLast((s) => s <= t)!);
      };

      return {
        offset: sampled(held, turn.over, { tolerance }),
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

export const GlobeShape = ({
  of,
  fill,
  fillOpacity,
  stroke,
  rule,
  draw,
  trim,
  ...rest
}: GlobeShapeProps): SceneElement => {
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

  if (draw !== undefined && trim !== undefined)
    throw new SceneError(
      `<GlobeShape> of ${of.what} has both draw and trim.`,
      "Give draw or trim, not both: draw={x} is trim={[0, x]}.",
    );

  const paint = {
    ...(fill !== undefined && { fill }),
    ...(fillOpacity !== undefined && { fillOpacity }),
    ...(stroke !== undefined && { stroke }),
    ...(rule !== undefined && { rule }),
    ...(draw !== undefined && { draw }),
    ...(trim !== undefined && { trim }),
  };

  return (
    <Group {...rest} clip={circle(of.radius)}>
      {of.pieces.map((geometry, i) => (
        <Shape key={of.keys[i]!} geometry={geometry} {...paint} />
      ))}
    </Group>
  );
};
