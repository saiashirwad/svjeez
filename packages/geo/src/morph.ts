import {
  ease,
  el,
  matchPaths,
  motion,
  rect,
  type Color,
  type Ease,
  type Point,
  type Rect,
  type Seconds,
  type SvgNode,
} from "svjeez";
import { resolveRegions, type RegionValues } from "./choropleth.ts";
import type { GeoMap, Region } from "./index.ts";
import { straighten } from "./writer.ts";

type Painter = (region: Region, value: number) => Color;

const isPainter = (fill: Color | Painter): fill is Painter => typeof fill === "function";

export interface MorphOptions {
  /** When the regions start to leave the map. */
  readonly at: Seconds;
  /** Seconds each takes. Default 1.2. */
  readonly over?: Seconds;
  readonly ease?: Ease;
  /** Seconds between one region leaving and the next, in the order of the shapes they become. Default 0. */
  readonly stagger?: Seconds;
  /** The fill of each shape: one color, or a color per region. Default grey. */
  readonly fill?: Color | ((region: Region, value: number) => Color);
  /** Px a point may stray when the outline is thinned for the morph. Larger is a smaller file. Default 2.5. */
  readonly detail?: number;
  readonly class?: string;
}

export interface Morphed {
  /** The shapes. Hidden until `at`, where each is its region's outline exactly, so a map under it can be hidden then. */
  readonly node: SvgNode;
  /** Path data for the regions that don't become a shape, to fade out as the others leave. */
  readonly rest: string;
}

export interface Bubble {
  readonly region: Region;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface CartogramOptions extends MorphOptions {
  /** The share of the map's frame the circles cover before they are pushed apart. Default 0.3. */
  readonly coverage?: number;
  /** Px kept between circles. Default 1. */
  readonly gap?: number;
}

export interface Cartogram extends Morphed {
  readonly bubbles: readonly Bubble[];
}

export interface BarsOptions extends MorphOptions {
  /** Where the bars go. The longest reaches its right edge; the bars share its height. */
  readonly frame: Rect;
  /** Biggest first (default) or smallest first. */
  readonly order?: "desc" | "asc";
  /** Keep this many bars. Default 12. */
  readonly top?: number;
  /** Px between bars. Default a fifth of a bar's slot. */
  readonly gap?: number;
  /** The value that fills the frame's width. Default the largest value shown. */
  readonly max?: number;
}

export interface Bar {
  readonly region: Region;
  readonly value: number;
  /** Where the bar lands in the scene, to put a label beside. */
  readonly rect: Rect;
}

export interface Bars extends Morphed {
  readonly bars: readonly Bar[];
}

const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

/** A ring's points, from the absolute first point and the relative steps `project()` writes. */
const points = (ring: string): [number, number][] => {
  const n = ring.match(NUMBER)!.map(Number);
  let [x, y] = [n[0]!, n[1]!];
  const out: [number, number][] = [[x, y]];

  for (let i = 2; i + 1 < n.length; i += 2) {
    x += n[i]!;
    y += n[i + 1]!;
    out.push([x, y]);
  }

  return out;
};

const boxArea = (line: readonly (readonly [number, number])[]): number => {
  const xs = line.map((p) => p[0]);
  const ys = line.map((p) => p[1]);

  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
};

/**
 * A region's outline for a morph: its rings, the biggest first so the mainland is the piece that becomes the shape,
 * thinned to `detail` px and without the pieces smaller than a few px. A morph stores every point several times as a
 * curve, and the map stays under it while it starts, so what it drops is not missed.
 */
const rings = (region: Region, detail: number): string[] =>
  (region.d.match(/M[^M]*/g) ?? [])
    .map(points)
    .sort((a, b) => boxArea(b) - boxArea(a))
    .filter((line, i) => i === 0 || boxArea(line) >= MIN_PIECE)
    .map((line) => {
      const xs = line.map((p) => p[0]);
      const ys = line.map((p) => p[1]);
      const size = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

      const kept = straighten(
        line.map(([x, y]): [number, number] => [x * 10, y * 10]),
        Math.max(detail, size * RELATIVE) * 5,
      );

      return `${kept.map(([x, y], i) => `${i ? "L" : "M"}${x / 10} ${y / 10}`).join("")}Z`;
    });

/** A piece may also be thinned by this share of its own diagonal, so a continent keeps no more points than its size can show. */
const RELATIVE = 0.012;

/** Px squared of bounding box below which a piece of a region isn't morphed. */
const MIN_PIECE = 150;

const circle = ({ x, y }: Point, r: number) =>
  `M${x - r} ${y}A${r} ${r} 0 1 0 ${x + r} ${y}A${r} ${r} 0 1 0 ${x - r} ${y}Z`;

const rectangle = ({ x, y, w, h }: Rect) => `M${x} ${y}H${x + w}V${y + h}H${x}Z`;

interface Target {
  readonly region: Region;
  readonly value: number;
  /** The one closed shape the mainland becomes. */
  readonly to: string;
  /** Where the region's other pieces shrink to. */
  readonly center: Point;
}

/** Each region as its outline, then as its target: the pieces other than the mainland shrink into the target's center. */
function morphs(targets: readonly Target[], map: GeoMap, options: MorphOptions): Morphed {
  const {
    at,
    over = 1.2,
    stagger = 0,
    ease: curve = ease.inOut,
    fill = "#6b7280",
    detail = 2.5,
  } = options;

  const used = new Set(targets.map((t) => t.region));

  const paths = targets.map(({ region, value, to, center }, i) => {
    const pieces = rings(region, detail);
    const crumbs = pieces.slice(1).map(() => circle(center, 0.01));
    const [start, end] = matchPaths([pieces.join(""), to + crumbs.join("")], { precision: 1 });

    return el.path({
      d: start,
      fill: isPainter(fill) ? fill(region, value) : fill,
      animation: motion({ d: start })
        .at(at + i * stagger)
        .to({ d: end }, over, curve),
    });
  });

  return {
    node: el.g(
      { class: options.class, animation: motion({ opacity: 0 }).at(at).set({ opacity: 1 }) },
      paths,
    ),
    rest: map.regions
      .filter((r) => !used.has(r))
      .map((r) => r.d)
      .join(""),
  };
}

/** The keys that carry a single positive number each, as `[region, value]`. */
const singles = (map: GeoMap, values: RegionValues, what: string): [Region, number][] => {
  const { found } = resolveRegions(map, values);

  const items = found.map(([region, value]): [Region, number] => {
    const id = JSON.stringify(region.id);

    const list = [value].flat();
    const only = list[0]!;

    if (list.length !== 1)
      throw new Error(
        `${what} takes one number per region, but ${id} has a list. Pass one time's values, as in { ${id}: values[${id}][i] }.`,
      );

    if (!(only > 0)) throw new Error(`${what} needs positive values, got ${only} for ${id}.`);

    return [region, only];
  });

  if (items.length === 0)
    throw new Error(
      `${what} found no region to draw. Check the keys of values against the map's region ids and names.`,
    );

  return items;
};

interface Disc {
  x: number;
  y: number;
  readonly r: number;
  readonly ox: number;
  readonly oy: number;
}

/**
 * Pushes circles apart until none overlap. Each is pulled gently back toward its origin, and each overlapping pair
 * moves apart along the line between them, the smaller one further. Deterministic, and kept inside `frame`.
 */
function relax(discs: Disc[], gap: number, frame: Rect): void {
  for (let pass = 0; pass < 400; pass++) {
    const pull = 0.04 * (1 - pass / 400);
    let moved = 0;

    for (const c of discs) {
      c.x += (c.ox - c.x) * pull;
      c.y += (c.oy - c.y) * pull;
    }

    for (const [i, a] of discs.entries())
      for (const b of discs.slice(i + 1)) {
        let [dx, dy] = [b.x - a.x, b.y - a.y];
        let d = Math.hypot(dx, dy);
        const need = a.r + b.r + gap;

        if (d >= need) continue;

        if (d < 1e-6) [dx, dy, d] = [Math.cos(i), Math.sin(i), 1];
        const push = need - d;
        const share = b.r / (a.r + b.r);
        [dx, dy] = [dx / d, dy / d];
        a.x -= dx * push * share;
        a.y -= dy * push * share;
        b.x += dx * push * (1 - share);
        b.y += dy * push * (1 - share);
        moved = Math.max(moved, push);
      }

    for (const c of discs) {
      c.x = Math.min(frame.x + frame.w - c.r, Math.max(frame.x + c.r, c.x));
      c.y = Math.min(frame.y + frame.h - c.r, Math.max(frame.y + c.r, c.y));
    }

    if (moved < 0.01 && pass > 40) break;
  }
}

const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * A Dorling cartogram: a circle per region with its area in proportion to its value, at the region's centroid and
 * nudged apart until none overlap. Each region morphs from its outline into its circle at `at`. Worked out while the
 * scene compiles. Regions in `values` need a positive number; the others come back in `rest`.
 */
export function cartogram(map: GeoMap, values: RegionValues, options: CartogramOptions): Cartogram {
  const { coverage = 0.3, gap = 1 } = options;
  const items = singles(map, values, "cartogram()");
  const total = items.reduce((sum, [, v]) => sum + v, 0);
  const k = Math.sqrt((coverage * map.frame.w * map.frame.h) / (Math.PI * total));

  const discs = items.map(([region, value]): Disc => {
    const { x, y } = region.centroid;

    return { x, y, r: k * Math.sqrt(value), ox: x, oy: y };
  });

  relax(discs, gap, map.frame);

  const bubbles = items.map(([region, value], i): Bubble => ({
    region,
    value,
    x: tenth(discs[i]!.x),
    y: tenth(discs[i]!.y),
    r: tenth(discs[i]!.r),
  }));

  return {
    bubbles,
    ...morphs(
      bubbles.map((b) => ({ region: b.region, value: b.value, to: circle(b, b.r), center: b })),
      map,
      options,
    ),
  };
}

/**
 * Regions fly from the map into a bar chart: the largest `top` values, sorted, each outline morphing into its bar.
 * The longest bar reaches the right edge of `frame`, or `max` does. Draw the labels from the returned `bars`.
 */
export function toBars(map: GeoMap, values: RegionValues, options: BarsOptions): Bars {
  const { frame, order = "desc", top = 12 } = options;

  const biggest = singles(map, values, "toBars()")
    .sort((a, b) => b[1] - a[1])
    .slice(0, top);

  const max = options.max ?? biggest[0]![1];
  const shown = order === "desc" ? biggest : [...biggest].reverse();
  const slot = frame.h / shown.length;
  const gap = options.gap ?? slot * 0.2;

  const bars = shown.map(([region, value], i): Bar => ({
    region,
    value,
    rect: rect(
      frame.x,
      tenth(frame.y + i * slot + gap / 2),
      tenth(Math.max(1, (frame.w * value) / max)),
      tenth(slot - gap),
    ),
  }));

  return {
    bars,
    ...morphs(
      bars.map((b) => ({
        region: b.region,
        value: b.value,
        to: rectangle(b.rect),
        center: { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 },
      })),
      map,
      options,
    ),
  };
}
