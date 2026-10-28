import type { Color, Point, Seconds, Span, SvgNode } from "svjeez";
import { el } from "svjeez";
import { flow, type FlowOptions } from "svjeez/extras";
import type { GeoMap, LonLat } from "./index.ts";

/** A route for `traffic()`, with how much of the traffic takes it and, if it differs, its color. */
export interface TrafficLine {
  readonly points: readonly Point[];
  /** This route's share of the departures, against the others'. Default 1. */
  readonly weight?: number;
  readonly color?: Color;
}

export interface TrafficOptions extends Omit<
  FlowOptions,
  "at" | "over" | "label" | "fill" | "ink"
> {
  /** When the particles leave: departures are spread over this span. */
  readonly during: Span;
  /** Departures per second, across all the routes. */
  readonly rate: number;
  /** Changes which routes and moments are picked, with the same result every build. Default 1. */
  readonly seed?: number;
  /** Let this share of the particles, 0 to 1, run their route backward. Default 0. */
  readonly back?: number;
}

export interface Traffic {
  readonly node: SvgNode;
  /** How many particles leave. */
  readonly count: number;
  /** When the last one arrives. */
  readonly end: Seconds;
}

/** A small seeded generator (mulberry32), so a scene builds the same every time. */
const generator = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Many particles along many routes: flights, trade, migration. `rate` departures a second over `during`, each on a
 * route picked by weight, at a moment jittered inside its own slot so they spread out evenly without lining up. Each
 * is a `flow()` token. A list of points stands for a route of weight 1.
 */
export function traffic(
  lines: readonly (readonly Point[] | TrafficLine)[],
  options: TrafficOptions,
): Traffic {
  const { during, rate, seed = 1, back = 0, ...token } = options;

  if (!(rate > 0)) throw new Error(`traffic() needs a positive rate, got ${rate}.`);

  if (!(during.over > 0))
    throw new Error(`traffic() needs a span with a positive length, got ${during.over}s.`);

  if (lines.length === 0) throw new Error("traffic() needs at least one route.");

  const routes = lines.map((line): TrafficLine => ("points" in line ? line : { points: line }));
  const weights = routes.map((r) => r.weight ?? 1);

  if (weights.some((w) => !(w >= 0)) || !weights.some((w) => w > 0))
    throw new Error(
      `traffic() needs weights that are not negative and not all zero, got ${weights.join(", ")}.`,
    );
  const sum = weights.reduce((a, b) => a + b, 0);
  const random = generator(seed);
  const count = Math.max(1, Math.round(rate * during.over));
  let end = during.at;

  const nodes = Array.from({ length: count }, (_, k) => {
    const at = during.at + ((k + random()) / count) * during.over;
    let pick = random() * sum;
    const index = weights.findIndex((w) => (pick -= w) < 0);
    const route = routes[index < 0 ? routes.length - 1 : index]!;
    const points = random() < back ? [...route.points].reverse() : route.points;
    const run = flow(points, { ...token, color: route.color ?? token.color, at });
    end = Math.max(end, run.end);

    return run.node;
  });

  return { node: el.g({}, nodes), count, end };
}

export interface ArcOptions {
  /** Px the arc rises above the straight line at its middle. Default a quarter of the distance. */
  readonly height?: number;
  /** Points on the arc. Default one per 6px. */
  readonly steps?: number;
}

/**
 * A curved route between two places on a flat map, bowed upward like a rainbow, as points for `flow()`, `travel()` and
 * `traffic()`. For a route that follows the globe, use `map.route()`.
 */
export function arc(
  map: GeoMap,
  from: LonLat | Point,
  to: LonLat | Point,
  options: ArcOptions = {},
): Point[] {
  const a = Array.isArray(from) ? map.point(from as LonLat) : (from as Point);
  const b = Array.isArray(to) ? map.point(to as LonLat) : (to as Point);
  const chord = Math.hypot(b.x - a.x, b.y - a.y);

  if (!(chord > 0)) throw new Error("arc() needs two different places.");
  const height = options.height ?? chord / 4;
  const steps = options.steps ?? Math.max(8, Math.min(200, Math.ceil(chord / 6)));

  // The normal that points up the page; level routes bow toward -y, vertical ones toward -x.
  let [nx, ny] = [(a.y - b.y) / chord, (b.x - a.x) / chord];

  if (ny > 0 || (ny === 0 && nx > 0)) [nx, ny] = [-nx, -ny];

  // A quadratic Bezier peaks half way to its control point, so the control point sits at twice the height.
  const control = { x: (a.x + b.x) / 2 + nx * height * 2, y: (a.y + b.y) / 2 + ny * height * 2 };

  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;

    return {
      x: Math.round((u * u * a.x + 2 * u * t * control.x + t * t * b.x) * 10) / 10,
      y: Math.round((u * u * a.y + 2 * u * t * control.y + t * t * b.y) * 10) / 10,
    };
  });
}
