/** @jsxImportSource svjeez */
import type { Color, Drawn, Part, Point, Rect, Span } from "svjeez";
import { random, span as spanOf } from "svjeez";
import { rect } from "svjeez/geometry";
import { flow, type FlowOptions } from "svjeez";
import type { GeoMap, LonLat } from "./index.ts";

export interface TrafficLine {
  /** The route's id as a part. Default its index in the list, `"0"`, `"1"`, … */
  readonly id?: string;
  readonly points: readonly Point[];
  /** This route's share of the departures, against the others'. Default 1. */
  readonly weight?: number;
  readonly color?: Color;
}

export interface TrafficOptions extends Omit<
  FlowOptions,
  "at" | "over" | "label" | "fill" | "ink"
> {
  readonly rate: number;
  readonly seed?: number;
  readonly back?: number;
}

/**
 * One route of `traffic()`. Its box covers its points, and its span runs from the first departure on it to the last
 * arrival, or is the instant 0 when no particle took it.
 */
export interface TrafficRoute extends Part {
  readonly points: readonly Point[];
  readonly count: number;
}

/**
 * Its parts are the routes, in the order given. `span` runs from the start of the departure window to when the last
 * particle arrives.
 */
export interface Traffic extends Drawn<TrafficRoute> {
  readonly count: number;
}

const boxOf = (points: readonly Point[]): Rect => {
  const [xs, ys] = [points.map((p) => p.x), points.map((p) => p.y)];
  const [left, top] = [Math.min(...xs), Math.min(...ys)];

  return rect(left, top, Math.max(...xs) - left, Math.max(...ys) - top);
};

/**
 * Many particles along many routes: `rate` departures a second over `during`, each on a route picked by weight.
 * Each is a `flow()` token. A list of points stands for a route of weight 1.
 */
export function traffic(
  during: Span,
  lines: readonly (readonly Point[] | TrafficLine)[],
  options: TrafficOptions,
): Traffic {
  const { rate, seed = 1, back = 0, ...token } = options;

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
  const next = random(seed);
  const count = Math.max(1, Math.round(rate * during.over));
  let end = during.at;
  const used = routes.map(() => ({ first: Infinity, last: -Infinity, count: 0 }));

  const nodes = Array.from({ length: count }, (_, k) => {
    const at = during.at + ((k + next()) / count) * during.over;
    let pick = next() * sum;
    const found = weights.findIndex((w) => (pick -= w) < 0);
    const index = found < 0 ? routes.length - 1 : found;
    const route = routes[index]!;
    const points = next() < back ? [...route.points].reverse() : route.points;
    const run = flow(points, { ...token, color: route.color ?? token.color, at });
    end = Math.max(end, run.span.end);
    const use = used[index]!;
    [use.first, use.last, use.count] = [
      Math.min(use.first, at),
      Math.max(use.last, run.span.end),
      use.count + 1,
    ];

    return run.node;
  });

  const parts = routes.map((route, i): TrafficRoute => ({
    id: route.id ?? String(i),
    box: boxOf(route.points),
    span:
      used[i]!.count > 0 ? spanOf(used[i]!.first, used[i]!.last - used[i]!.first) : spanOf(0, 0),
    points: route.points,
    count: used[i]!.count,
  }));

  return {
    node: <g>{nodes}</g>,
    count,
    span: spanOf(during.at, end - during.at),
    bounds: parts.map((p) => p.box).reduce((a, b) => a.union(b)),
    parts,
    part(id) {
      const found = parts.find((p) => p.id === id);

      if (!found)
        throw new Error(
          `traffic() has no route ${JSON.stringify(id)}. Its routes are ${parts
            .slice(0, 6)
            .map((p) => JSON.stringify(p.id))
            .join(", ")}${parts.length > 6 ? ", …" : ""}.`,
        );

      return found;
    },
  };
}

export interface ArcOptions {
  /** Px the arc rises above the straight line at its middle. Default a quarter of the distance. */
  readonly height?: number;
  /** Points on the arc. Default one per 6px. */
  readonly steps?: number;
}

const isLonLat = (place: LonLat | Point): place is LonLat => Array.isArray(place);

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
  const a = isLonLat(from) ? map.point(from) : from;
  const b = isLonLat(to) ? map.point(to) : to;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);

  if (!(chord > 0)) throw new Error("arc() needs two different places.");
  const height = options.height ?? chord / 4;
  const steps = options.steps ?? Math.max(8, Math.min(200, Math.ceil(chord / 6)));

  let [nx, ny] = [(a.y - b.y) / chord, (b.x - a.x) / chord];

  if (ny > 0 || (ny === 0 && nx > 0)) [nx, ny] = [-nx, -ny];

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
