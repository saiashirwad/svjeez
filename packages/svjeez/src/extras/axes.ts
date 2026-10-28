import type { Paint } from "../attributes";
import { def } from "../defs";
import { el } from "../el";
import type { FontValue } from "../font/font";
import { rect, type Point, type Rect } from "../geometry";
import type { Motion } from "../motion";
import type { SvgNode } from "../svg";
import { defaultDark, tint, type Base16 } from "./theme";
import { calculus, type Calculus } from "./calculus";

export interface AxesOptions {
  /** Graph range of the x axis, `[min, max]`. */
  readonly x: readonly [number, number];
  /** Graph range of the y axis, `[min, max]`. */
  readonly y: readonly [number, number];
  /** Size of the plot area in px. */
  readonly width: number;
  readonly height: number;
  /** Top-left of the plot area. Default the origin. */
  readonly at?: Point;
  /** Tick step in graph units per axis. An axis without one has no ticks. */
  readonly ticks?: { readonly x?: number; readonly y?: number };
  /** Numbers at the ticks. Default true. */
  readonly labels?: boolean;
  /** Faint lines across the plot at the ticks. */
  readonly grid?: boolean;
  /** Axis lines use `comment`, labels `muted`. Default `defaultDark`. */
  readonly theme?: Base16;
  readonly fontSize?: number;
  readonly font?: FontValue | string;
}

export interface PlotOptions {
  /** Points sampled across `from`..`to`. Default 200. */
  readonly samples?: number;
  /** Default the x range. */
  readonly from?: number;
  readonly to?: number;
  /** Default the theme's blue. */
  readonly color?: Paint;
  readonly strokeWidth?: number;
  readonly animation?: Motion<"draw">;
}

export interface Plot {
  readonly node: SvgNode;
  /** The path data. A gap in the curve starts a new `M`. */
  readonly d: string;
  /** Every sampled point that was drawn, in scene px. */
  readonly points: readonly Point[];
}

export interface Axes extends Calculus {
  readonly node: SvgNode;
  /** The plot area. */
  readonly bounds: Rect;
  /** Graph coordinates to scene px. */
  point(x: number, y: number): Point;
  plot(f: (x: number) => number, options?: PlotOptions): Plot;
}

const TICK = 4;
const MAX_TICKS = 500;

const round = (n: number): number => Math.round(n * 10) / 10;

/** Drops float noise (0.30000000000000004) and `-0`. */
const compact = (n: number): string => String(Number(n.toPrecision(12)) + 0);

const checkRange = (name: string, [min, max]: readonly [number, number]): void => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min)
    throw new Error(
      `axes() needs a finite ${name} range with max above min, got [${min}, ${max}].`,
    );
};

const ticksIn = (name: string, [min, max]: readonly [number, number], step: number): number[] => {
  if (!(step > 0) || !Number.isFinite(step))
    throw new Error(`axes() needs a positive ${name} tick step, got ${step}.`);

  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);

  if (last - first + 1 > MAX_TICKS)
    throw new Error(
      `axes() would draw ${last - first + 1} ${name} ticks. Raise the step ${step} to draw at most ${MAX_TICKS}.`,
    );

  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => (first + i) * step);
};

export function axes(options: AxesOptions): Axes {
  const { x: xr, y: yr, width, height, at = { x: 0, y: 0 }, theme = defaultDark } = options;
  const { ticks = {}, grid = false, fontSize = 12, font } = options;
  const labels = options.labels ?? true;

  checkRange("x", xr);
  checkRange("y", yr);

  if (!(width > 0) || !(height > 0) || !Number.isFinite(width + height))
    throw new Error(`axes() needs a positive width and height, got ${width} and ${height}.`);

  if (!(fontSize > 0)) throw new Error(`axes() needs a positive fontSize, got ${fontSize}.`);

  const xs = ticks.x === undefined ? [] : ticksIn("x", xr, ticks.x);
  const ys = ticks.y === undefined ? [] : ticksIn("y", yr, ticks.y);

  const [xSpan, ySpan] = [xr[1] - xr[0], yr[1] - yr[0]];
  const px = (gx: number): number => at.x + ((gx - xr[0]) / xSpan) * width;
  const py = (gy: number): number => at.y + height - ((gy - yr[0]) / ySpan) * height;
  const point = (gx: number, gy: number): Point => ({ x: px(gx), y: py(gy) });
  const bounds = rect(at.x, at.y, width, height);

  const zeroInX = xr[0] <= 0 && xr[1] >= 0;
  const zeroInY = yr[0] <= 0 && yr[1] >= 0;
  const origin = point(zeroInX ? 0 : xr[0], zeroInY ? 0 : yr[0]);

  const muted = tint(theme, "comment");
  const labelColor = tint(theme, "muted");

  const line = (x1: number, y1: number, x2: number, y2: number, strokeWidth = 1) =>
    el.line({ x1, y1, x2, y2, stroke: muted, strokeWidth });

  const text = (x: number, y: number, anchor: "middle" | "end", value: number) =>
    el.text(
      { x, y, fontSize, textAnchor: anchor, fill: labelColor, fontFamily: font },
      compact(value),
    );

  const node = el.g({}, [
    grid
      ? el.g({ strokeOpacity: 0.25 }, [
          ...xs.map((v) => line(px(v), bounds.y, px(v), bounds.y + height)),
          ...ys.map((v) => line(bounds.x, py(v), bounds.x + width, py(v))),
        ])
      : undefined,
    line(bounds.x, origin.y, bounds.x + width, origin.y, 1.5),
    line(origin.x, bounds.y, origin.x, bounds.y + height, 1.5),
    ...xs.map((v) => line(px(v), origin.y - TICK, px(v), origin.y + TICK)),
    ...ys.map((v) => line(origin.x - TICK, py(v), origin.x + TICK, py(v))),
    labels
      ? [
          ...xs.map((v) => text(px(v), origin.y + TICK + fontSize, "middle", v)),
          ...ys
            .filter((v) => !(v === 0 && zeroInY))
            .map((v) => text(origin.x - TICK - 3, py(v) + fontSize * 0.35, "end", v)),
        ]
      : undefined,
  ]);

  const clip = def.clipPath({}, el.rect({ x: bounds.x, y: bounds.y, width, height }));

  function plot(f: (x: number) => number, plotOptions: PlotOptions = {}): Plot {
    const { samples = 200, from = xr[0], to = xr[1], strokeWidth = 2.5 } = plotOptions;
    const color = plotOptions.color ?? tint(theme, "blue");

    if (!Number.isInteger(samples) || samples < 2)
      throw new Error(`plot() needs a whole number of samples, at least 2, got ${samples}.`);

    if (!Number.isFinite(from + to) || to <= from)
      throw new Error(`plot() needs from below to, got from ${from} and to ${to}.`);

    // Past one plot height outside the range a point is dropped, and so is a jump taller than the range.
    const [low, high] = [yr[0] - ySpan, yr[1] + ySpan];
    const points: Point[] = [];
    let d = "";
    let previous: number | undefined;

    for (let i = 0; i < samples; i++) {
      const gx = from + ((to - from) * i) / (samples - 1);
      const gy = f(gx);

      if (!Number.isFinite(gy) || gy < low || gy > high) {
        previous = undefined;
        continue;
      }

      const p = point(gx, gy);
      const [rx, ry] = [round(p.x), round(p.y)];
      const joined = previous !== undefined && Math.abs(gy - previous) <= ySpan;

      d += `${joined ? "L" : "M"}${rx} ${ry}`;
      points.push({ x: rx, y: ry });
      previous = gy;
    }

    if (points.length === 0)
      throw new Error(
        `plot() found no finite values inside the y range between ${from} and ${to}.`,
      );

    return {
      d,
      points,
      node: el.g(
        { clipPath: clip },
        el.path({
          d,
          fill: "none",
          stroke: color,
          strokeWidth,
          strokeLinejoin: "round",
          strokeLinecap: "round",
          animation: plotOptions.animation,
        }),
      ),
    };
  }

  return { node, bounds, point, plot, ...calculus({ x: xr, y: yr, bounds, theme, clip, point }) };
}
