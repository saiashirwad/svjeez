import type { Attrs, Color, Paint } from "../attributes";
import type { Ref } from "../defs";
import { easeAt } from "../ease-at";
import { el } from "../el";
import type { Point, Rect } from "../geometry";
import {
  ease,
  motion,
  type Ease,
  type Motion,
  type Seconds,
  type Span,
  type Stack,
} from "../motion";
import { sampledPath, type PathData } from "../paths";
import { sampled } from "../recipes";
import type { SvgNode } from "../svg";
import { tint, type Base16 } from "./theme";

type Fn = (x: number) => number;

/** `from` moves to `to` during the span. `ease` (default `ease.inOut`) shapes the move. */
export interface Sweep extends Span {
  readonly from: number;
  readonly to: number;
  readonly ease?: Ease;
}

/** A graph value over time: a number holds still, a sweep moves it, and sweeps in a row chain, holding between them. */
export type Moving = number | Sweep | readonly Sweep[];

export interface DotOptions {
  /** Radius in px. Default 5. */
  readonly r?: number;
  /** Default the theme's yellow. */
  readonly color?: Paint;
}

export interface Dot {
  readonly node: SvgNode;
  /** The dot's travel as `x`/`y`. Put it on a `<g>` to carry a label with the dot. */
  readonly motion: Motion<"x" | "y">;
  /** Where the dot is at scene time `t`, in scene px. */
  point(t: Seconds): Point;
}

export interface LineOptions {
  /** Length in px. Default half the plot width. A secant grows past it to reach both points. */
  readonly length?: number;
  /** Default the theme's red. */
  readonly color?: Paint;
  readonly strokeWidth?: number;
  /** Dots where the line meets the curve. Default true for a secant, false for a tangent. */
  readonly points?: boolean | DotOptions;
}

export interface Line {
  readonly node: SvgNode;
  /** The line's slope in graph units at scene time `t`. */
  slope(t: Seconds): number;
}

export interface AreaOptions {
  /** Default the theme's blue. */
  readonly color?: Paint;
  /** Default 0.25. */
  readonly opacity?: number;
  /** The level the region reaches down (or up) to. Default 0. */
  readonly base?: number;
  /** Points along the curve. Default 120. */
  readonly samples?: number;
}

export interface Area {
  readonly node: SvgNode;
  /** The signed area between the curve and `base` at scene time `t`. */
  value(t: Seconds): number;
}

export interface RiemannOptions {
  /** Default the x range. */
  readonly from?: number;
  readonly to?: number;
  /** Rectangle counts, one per stage. */
  readonly n: number | readonly number[];
  /** When each stage after the first begins, one time per later stage. */
  readonly at?: readonly Seconds[];
  /** Seconds each split takes. Default 0.8. */
  readonly over?: Seconds;
  /** Default `ease.inOut`. */
  readonly ease?: Ease;
  /** Where each rectangle meets the curve. Default `"mid"`. */
  readonly rule?: "left" | "mid" | "right";
  /** Default the theme's yellow. */
  readonly color?: Color;
  /** Fill opacity. Default 0.3. */
  readonly opacity?: number;
}

export interface Riemann {
  readonly node: SvgNode;
  /** The Riemann sum of each stage, in graph units. */
  readonly sums: readonly number[];
}

export interface CurveOptions {
  /** Points along the curve. Default 200, or 400 for parametric and polar curves. */
  readonly samples?: number;
  /** Default the theme's blue. */
  readonly color?: Paint;
  readonly strokeWidth?: number;
  readonly animation?: Motion<"draw">;
}

export interface MorphCurveOptions extends Omit<CurveOptions, "color"> {
  /** When each curve after the first begins, one time per later curve. */
  readonly at: readonly Seconds[];
  /** Seconds each bend takes. Default 1. */
  readonly over?: Seconds;
  /** Default `ease.inOut`. */
  readonly ease?: Ease;
  /** Default the x range. */
  readonly from?: number;
  readonly to?: number;
  /** One color for all, or one per curve, which the stroke moves through with the bend. Default the theme's blue. */
  readonly color?: Color | readonly Color[];
}

export interface Curve {
  readonly node: SvgNode;
  /** The path data. A gap in the curve starts a new `M`. */
  readonly d: PathData;
  /** Every sampled point that was drawn, in scene px. */
  readonly points: readonly Point[];
}

/** Calculus on a set of axes: values that move along a function, lines that touch it, areas under it, curves that bend. */
export interface Calculus {
  /** A dot on `f` at `x`, which rides the curve as `x` moves. */
  dot(f: Fn, x: Moving, options?: DotOptions): Dot;
  /** The tangent to `f` at `x`, sliding along the curve as `x` moves. */
  tangent(f: Fn, x: Moving, options?: LineOptions): Line;
  /** The line through `f` at `x` and `x + h`. Move `h` to 0 and it settles onto the tangent. */
  secant(f: Fn, x: Moving, h: Moving, options?: LineOptions): Line;
  /** The region between `f` and `base` from `from` to `to`; either bound can move. */
  area(f: Fn, from: Moving, to: Moving, options?: AreaOptions): Area;
  /** Riemann rectangles under `f` that split into the next stage's count, as one path whose `d` morphs. */
  riemann(f: Fn, options: RiemannOptions): Riemann;
  /** One curve that bends from each function into the next, sampled on one grid so its `d` morphs. */
  morph(fs: readonly Fn[], options: MorphCurveOptions): Curve;
  /** The curve `(t) => [x, y]` for `t` across `range`. */
  parametric(
    fn: (t: number) => readonly [number, number],
    range: readonly [number, number],
    options?: CurveOptions,
  ): Curve;
  /** The curve `r = fn(θ)` around the origin, for `θ` across `range` (default a full turn). */
  polar(
    fn: (theta: number) => number,
    range?: readonly [number, number],
    options?: CurveOptions,
  ): Curve;
}

/** What `axes()` hands the calculus methods. */
export interface GraphContext {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly bounds: Rect;
  readonly theme: Base16;
  readonly clip: Ref<"clipPath">;
  point(x: number, y: number): Point;
}

const round = (n: number): number => Math.round(n * 10) / 10;

const pt = (p: Point): string => `${round(p.x)} ${round(p.y)}`;

const polyline = ([first, ...rest]: readonly Point[], close = ""): PathData =>
  `M${pt(first!)}${rest.map((p) => `L${pt(p)}`).join("")}${close}`;

/** Subpaths written one after another as one path. */
const joined = ([first, ...rest]: readonly PathData[]): PathData =>
  rest.reduce<PathData>((d, next) => `${d}${next}`, first!);

const sweepsOf = (m: Moving): readonly Sweep[] =>
  m instanceof Object ? ("from" in m ? [m] : m) : [];

/** `m` as a function of scene time. */
const valueOf = (m: Moving, what: string): ((t: Seconds) => number) => {
  const sweeps = sweepsOf(m);

  if (!(m instanceof Object)) {
    const value = Number(m);

    if (!Number.isFinite(value)) throw new Error(`${what} needs a finite value, got ${value}.`);

    return () => value;
  }

  if (sweeps.length === 0) throw new Error(`${what} needs at least one sweep.`);
  sweeps.forEach((s, i) => {
    if (!Number.isFinite(s.from + s.to) || !(s.at >= 0) || !(s.over > 0))
      throw new Error(
        `${what} needs finite from and to, a non-negative at and a positive over, got ${JSON.stringify(s)}.`,
      );

    if (i > 0 && s.at < sweeps[i - 1]!.at + sweeps[i - 1]!.over - 1e-9)
      throw new Error(`${what} has a sweep at ${s.at}s that starts before the one before it ends.`);
  });

  return (t) => {
    const s = sweeps.findLast((sweep) => sweep.at <= t) ?? sweeps[0]!;
    const u = Math.min(1, Math.max(0, (t - s.at) / s.over));

    return s.from + (s.to - s.from) * easeAt(s.ease ?? ease.inOut, u);
  };
};

/** When the last sweep among `ms` ends, or 0 when none moves. */
const endOf = (...ms: Moving[]): Seconds =>
  Math.max(0, ...ms.flatMap(sweepsOf).map((s) => s.at + s.over));

const checkSamples = (what: string, samples: number): void => {
  if (!Number.isInteger(samples) || samples < 2)
    throw new Error(`${what} needs a whole number of samples, at least 2, got ${samples}.`);
};

const checkStages = (what: string, count: number, at: readonly Seconds[] | undefined): void => {
  if ((at?.length ?? 0) !== count - 1)
    throw new Error(
      `${what} has ${count} stages, so it needs ${count - 1} start times in at, got ${at?.length ?? 0}.`,
    );
};

/** A motion over `times` stages of path data, each later stage starting at its `at`. */
const stagesOf = (
  ds: readonly PathData[],
  at: readonly Seconds[],
  over: Seconds,
  curve: Ease,
  colors?: readonly Color[],
): Motion<"d" | "stroke"> => {
  // SAFETY: stroke is either set on every stage or on none, so each transition moves the same channels.
  const values = (i: number) =>
    (colors ? { d: ds[i]!, stroke: colors[i]! } : { d: ds[i]! }) as { d: PathData; stroke: Color };

  return ds
    .slice(1)
    .reduce<Motion<"d" | "stroke">>(
      (track, _, i) => track.at(at[i]!).to(values(i + 1), over, curve),
      motion(values(0)),
    );
};

export function calculus(graph: GraphContext): Calculus {
  const { x: xr, y: yr, bounds, theme, clip, point } = graph;
  const [xSpan, ySpan] = [xr[1] - xr[0], yr[1] - yr[0]];
  const [low, high] = [yr[0] - ySpan, yr[1] + ySpan];
  // Just past the plot, so a point leaving it bends at a steady speed and the clip hides the rest.
  const clamp = (y: number) => Math.min(yr[1] + ySpan * 0.1, Math.max(yr[0] - ySpan * 0.1, y));
  const [sx, sy] = [bounds.w / xSpan, bounds.h / ySpan];

  /** A path whose data `at(t)` writes, baked into a `d` motion when it moves before `end`. */
  const movingPath = (end: Seconds, at: (t: Seconds) => PathData, attrs: Attrs<"path">): SvgNode =>
    el.path({
      ...attrs,
      d: at(0),
      animation: end > 0 ? sampledPath(at, { duration: end, tolerance: 0.4 }) : undefined,
    });

  const dotAt = (where: (t: Seconds) => Point, end: Seconds, options: DotOptions = {}): Dot => {
    const { r = 5 } = options;
    const color = options.color ?? tint(theme, "yellow");
    const start = where(0);

    const travel =
      end > 0
        ? sampled(
            (t) => {
              const p = where(t);

              return { x: round(p.x), y: round(p.y) };
            },
            { duration: end, tolerance: { translate: 0.3 } },
          )
        : motion({ x: round(start.x), y: round(start.y) });

    return {
      motion: travel,
      point: where,
      node: el.g({ animation: travel }, el.circle({ r, fill: color })),
    };
  };

  const finite = (what: string, x: number, y: number): number => {
    if (!Number.isFinite(y)) throw new Error(`${what} found no finite value of f at x=${x}.`);

    return y;
  };

  const derivative = (f: Fn, x: number): number => {
    const h = xSpan * 1e-5;

    return (f(x + h) - f(x - h)) / (2 * h);
  };

  /** A segment through `p` along graph slope `m`, `length` px long, centered on `center`. */
  const segment = (center: Point, m: number, length: number): PathData => {
    const [dx, dy] = [sx, -m * sy];
    const norm = Math.hypot(dx, dy);
    const [ux, uy] = [((dx / norm) * length) / 2, ((dy / norm) * length) / 2];

    return polyline([
      { x: center.x - ux, y: center.y - uy },
      { x: center.x + ux, y: center.y + uy },
    ]);
  };

  const lineNode = (
    what: string,
    end: Seconds,
    path: (t: Seconds) => PathData,
    dots: readonly ((t: Seconds) => Point)[],
    options: LineOptions,
  ): SvgNode => {
    const { strokeWidth = 2 } = options;
    const color = options.color ?? tint(theme, "red");
    const dotOptions = options.points instanceof Object ? options.points : { color };

    if (options.length !== undefined && !(options.length > 0))
      throw new Error(`${what} needs a positive length, got ${options.length}.`);

    return el.g({}, [
      el.g(
        { clipPath: clip },
        movingPath(end, path, { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round" }),
      ),
      ...dots.map((where) => dotAt(where, end, { r: 4, ...dotOptions }).node),
    ]);
  };

  function dot(f: Fn, x: Moving, options?: DotOptions): Dot {
    const at = valueOf(x, "dot() x");

    return dotAt(
      (t) => {
        const gx = at(t);

        return point(gx, finite("dot()", gx, f(gx)));
      },
      endOf(x),
      options,
    );
  }

  function tangent(f: Fn, x: Moving, options: LineOptions = {}): Line {
    const at = valueOf(x, "tangent() x");
    const length = options.length ?? bounds.w / 2;

    const slope = (t: Seconds) => {
      const m = derivative(f, at(t));

      if (!Number.isFinite(m)) throw new Error(`tangent() found no finite slope at x=${at(t)}.`);

      return m;
    };

    const touch = (t: Seconds) => point(at(t), finite("tangent()", at(t), f(at(t))));

    return {
      slope,
      node: lineNode(
        "tangent()",
        endOf(x),
        (t) => segment(touch(t), slope(t), length),
        options.points ? [touch] : [],
        options,
      ),
    };
  }

  function secant(f: Fn, x: Moving, h: Moving, options: LineOptions = {}): Line {
    const [at, step] = [valueOf(x, "secant() x"), valueOf(h, "secant() h")];
    const length = options.length ?? bounds.w / 2;
    const near = xSpan * 1e-6;

    const slope = (t: Seconds) => {
      const [gx, gh] = [at(t), step(t)];
      const m = Math.abs(gh) < near ? derivative(f, gx) : (f(gx + gh) - f(gx)) / gh;

      if (!Number.isFinite(m))
        throw new Error(`secant() found no finite slope at x=${gx}, h=${gh}.`);

      return m;
    };

    const ends = [(t: Seconds) => at(t), (t: Seconds) => at(t) + step(t)].map(
      (gx) => (t: Seconds) => point(gx(t), finite("secant()", gx(t), f(gx(t)))),
    );

    const path = (t: Seconds) => {
      const [p, q] = [ends[0]!(t), ends[1]!(t)];
      const center = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };

      return segment(center, slope(t), Math.max(length, Math.hypot(q.x - p.x, q.y - p.y) + 48));
    };

    return {
      slope,
      node: lineNode("secant()", endOf(x, h), path, options.points === false ? [] : ends, options),
    };
  }

  function area(f: Fn, from: Moving, to: Moving, options: AreaOptions = {}): Area {
    const { opacity = 0.25, base = 0, samples = 120 } = options;
    const color = options.color ?? tint(theme, "blue");
    const [a, b] = [valueOf(from, "area() from"), valueOf(to, "area() to")];

    checkSamples("area()", samples);

    const xs = (t: Seconds) =>
      Array.from({ length: samples }, (_, i) => a(t) + ((b(t) - a(t)) * i) / (samples - 1));

    const path = (t: Seconds) => {
      const curve = xs(t).map((gx) => point(gx, clamp(finite("area()", gx, f(gx)))));

      return polyline([point(a(t), base), ...curve, point(b(t), base)], "Z");
    };

    const value = (t: Seconds) => {
      const points = xs(t);
      const dx = (b(t) - a(t)) / (samples - 1);

      return points.reduce(
        (sum, gx, i) => sum + (f(gx) - base) * dx * (i === 0 || i === samples - 1 ? 0.5 : 1),
        0,
      );
    };

    return {
      value,
      node: el.g(
        { clipPath: clip },
        movingPath(endOf(from, to), path, { fill: color, fillOpacity: opacity, stroke: "none" }),
      ),
    };
  }

  function riemann(f: Fn, options: RiemannOptions): Riemann {
    const { from = xr[0], to = xr[1], over = 0.8, rule = "mid", opacity = 0.3 } = options;
    const color = options.color ?? tint(theme, "yellow");
    const ns = [options.n].flat();

    if (ns.length === 0 || ns.some((n) => !Number.isInteger(n) || n < 1))
      throw new Error(
        `riemann() needs whole rectangle counts of at least 1, got [${ns.join(", ")}].`,
      );

    if (!Number.isFinite(from + to) || to <= from)
      throw new Error(`riemann() needs from below to, got from ${from} and to ${to}.`);
    checkStages("riemann()", ns.length, options.at ?? []);

    const most = Math.max(...ns);
    const offset = { left: 0, mid: 0.5, right: 1 }[rule];

    const heights = ns.map((n) =>
      Array.from({ length: n }, (_, j) => {
        const gx = from + ((j + offset) * (to - from)) / n;

        return finite("riemann()", gx, f(gx));
      }),
    );

    const sums = heights.map((hs) => (hs.reduce((s, h) => s + h, 0) * (to - from)) / hs.length);

    /** `most` rectangles per stage, each a copy of the stage rectangle it lies in, so every stage has the same commands. */
    const ds = ns.map((n, s) => {
      const rects = Array.from({ length: most }, (_, k) => {
        const j = Math.floor((k * n) / most);
        const [x0, x1] = [from + (j * (to - from)) / n, from + ((j + 1) * (to - from)) / n];
        const [y0, y1] = [0, clamp(heights[s]![j]!)];

        return polyline([point(x0, y0), point(x1, y0), point(x1, y1), point(x0, y1)], "Z");
      });

      return joined(rects);
    });

    return {
      sums,
      node: el.g(
        { clipPath: clip },
        el.path({
          d: ds[0]!,
          fill: color,
          fillOpacity: opacity,
          stroke: color,
          strokeWidth: 1.5,
          strokeLinejoin: "round",
          animation:
            ds.length > 1
              ? stagesOf(ds, options.at ?? [], over, options.ease ?? ease.inOut)
              : undefined,
        }),
      ),
    };
  }

  /** Graph points to path data, breaking where a point is missing, leaves the range well behind, or jumps by more than the range. */
  const trace = (
    what: string,
    samples: readonly (readonly [number, number])[],
  ): Omit<Curve, "node"> => {
    const runs: Point[][] = [];
    let previous: readonly [number, number] | undefined;

    for (const [gx, gy] of samples) {
      if (!Number.isFinite(gx + gy) || gy < low || gy > high) {
        previous = undefined;
        continue;
      }

      const p = point(gx, gy);

      const continues =
        previous !== undefined &&
        Math.abs(gy - previous[1]) <= ySpan &&
        Math.abs(gx - previous[0]) <= xSpan;

      if (!continues) runs.push([]);
      runs.at(-1)!.push({ x: round(p.x), y: round(p.y) });
      previous = [gx, gy];
    }

    if (runs.length === 0) throw new Error(`${what} found no finite points inside the y range.`);

    return { d: joined(runs.map((run) => polyline(run))), points: runs.flat() };
  };

  const stroked = (
    d: PathData,
    options: CurveOptions,
    animation?: Stack<"draw" | "d" | "stroke">,
  ) =>
    el.g(
      { clipPath: clip },
      el.path({
        d,
        fill: "none",
        stroke: options.color ?? tint(theme, "blue"),
        strokeWidth: options.strokeWidth ?? 2.5,
        strokeLinejoin: "round",
        strokeLinecap: "round",
        animation,
      }),
    );

  const curveOf = (
    what: string,
    samples: readonly (readonly [number, number])[],
    options: CurveOptions,
  ): Curve => {
    const { d, points } = trace(what, samples);

    return { d, points, node: stroked(d, options, options.animation) };
  };

  function parametric(
    fn: (t: number) => readonly [number, number],
    range: readonly [number, number],
    options: CurveOptions = {},
  ): Curve {
    const { samples = 400 } = options;
    const [t0, t1] = range;

    checkSamples("parametric()", samples);

    if (!Number.isFinite(t0 + t1) || t1 <= t0)
      throw new Error(
        `parametric() needs a range with its end above its start, got [${t0}, ${t1}].`,
      );

    return curveOf(
      "parametric()",
      Array.from({ length: samples }, (_, i) => fn(t0 + ((t1 - t0) * i) / (samples - 1))),
      options,
    );
  }

  function polar(
    fn: (theta: number) => number,
    range: readonly [number, number] = [0, 2 * Math.PI],
    options: CurveOptions = {},
  ): Curve {
    return parametric(
      (theta) => {
        const r = fn(theta);

        return [r * Math.cos(theta), r * Math.sin(theta)];
      },
      range,
      options,
    );
  }

  function morph(fs: readonly Fn[], options: MorphCurveOptions): Curve {
    const { samples = 200, from = xr[0], to = xr[1], over = 1 } = options;

    const palette = [options.color].flat().filter((c) => c !== undefined);
    const colors = palette.length > 1 ? palette : undefined;

    if (fs.length < 2)
      throw new Error(`graph.morph() needs at least two functions, got ${fs.length}.`);
    checkSamples("graph.morph()", samples);
    checkStages("graph.morph()", fs.length, options.at);

    if (colors && colors.length !== fs.length)
      throw new Error(
        `graph.morph() needs one color per function, got ${colors.length} for ${fs.length}.`,
      );

    if (!Number.isFinite(from + to) || to <= from)
      throw new Error(`graph.morph() needs from below to, got from ${from} and to ${to}.`);

    const xs = Array.from({ length: samples }, (_, i) => from + ((to - from) * i) / (samples - 1));

    const lines = fs.map((f) =>
      xs.map((gx) => point(gx, clamp(finite("graph.morph()", gx, f(gx))))),
    );

    const ds = lines.map((ps) => polyline(ps));
    const bend = stagesOf(ds, options.at, over, options.ease ?? ease.inOut, colors);
    const color = palette[0];

    return {
      d: ds[0]!,
      points: lines[0]!.map((p) => ({ x: round(p.x), y: round(p.y) })),
      node: stroked(
        ds[0]!,
        { ...options, color },
        [options.animation, bend].filter((m) => m !== undefined),
      ),
    };
  }

  return { dot, tangent, secant, area, riemann, morph, parametric, polar };
}

export type ReadoutOptions = Span &
  Attrs<"text"> & {
    /** Seconds between samples. Default 1/12. */
    readonly step?: Seconds;
  };

/**
 * Text that changes with time: `text(t)` sampled across the span, each distinct string shown while it holds. The
 * other options are attributes of every `<text>`, such as `x`, `y`, `fill` and `textAnchor`.
 */
export function readout(text: (t: Seconds) => string, options: ReadoutOptions): SvgNode {
  const { at, over, step = 1 / 12, ...attrs } = options;

  if (!(at >= 0) || !(over > 0))
    throw new Error(
      `readout() needs a non-negative at and a positive over, got at ${at} and over ${over}.`,
    );

  if (!(step > 0)) throw new Error(`readout() needs a positive step, got ${step}.`);
  const count = Math.max(1, Math.round(over / step));
  const times = Array.from({ length: count + 1 }, (_, i) => at + (over * i) / count);
  const windows = new Map<string, [Seconds, Seconds | undefined][]>();
  let current: string | undefined;

  times.forEach((t, i) => {
    const s = text(t);

    if (s === current) return;
    const open = current === undefined ? undefined : windows.get(current)!.at(-1);

    if (open) open[1] = t;
    windows.set(s, [...(windows.get(s) ?? []), [i === 0 ? 0 : t, undefined]]);
    current = s;
  });

  return el.g(
    {},
    [...windows].map(([s, spans]) => {
      const shown = spans[0]![0] === 0;

      const track = spans.reduce<Motion<"opacity">>(
        (m, [on, off], i) => {
          const lit = i === 0 && shown ? m : m.at(on).set({ opacity: 1 });

          return off === undefined ? lit : lit.at(off).set({ opacity: 0 });
        },
        motion({ opacity: shown ? 1 : 0 }),
      );

      return el.text({ ...attrs, animation: track }, s);
    }),
  );
}
