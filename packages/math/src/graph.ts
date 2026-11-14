import {
  def,
  rect,
  tint,
  type Base16,
  type FontValue,
  type Paint,
  type Point,
  type Rect,
  type Ref,
  type SvgNode,
} from "svjeez";
import { el } from "svjeez/internal";

export type Range = readonly [number, number];

/** What `plane()` works out once from its options, and every drawing reads. */
export interface Frame {
  readonly x: Range;
  readonly y: Range;
  /** The plot area in scene px. */
  readonly bounds: Rect;
  /** Pixels per graph unit along each axis. */
  readonly sx: number;
  readonly sy: number;
  /** Graph units to scene px, y up. */
  point(x: number, y: number): Point;
  /** Where (0, 0) sits in scene px, in the plot area or not. */
  readonly origin: Point;
  /** Where the axis lines cross in graph units: zero, or the low end of a range that leaves zero out. */
  readonly cross: readonly [number, number];
  /** The tick values on each axis. */
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly labels: boolean;
  readonly grid: boolean;
  readonly theme: Base16;
  readonly fontSize: number;
  readonly font: FontValue | string | undefined;
  /** Hides what a curve does outside the plot area. */
  readonly clip: Ref<"clipPath">;
}

export interface FrameOptions {
  readonly x: Range;
  readonly y: Range;
  readonly width: number;
  readonly height: number;
  readonly at?: Point;
  readonly ticks?: number | { readonly x?: number; readonly y?: number };
  readonly labels?: boolean;
  readonly grid?: boolean;
  readonly theme: Base16;
  readonly fontSize?: number;
  readonly font?: FontValue | string;
}

const TICK = 4;
const MAX_TICKS = 500;

const round = (n: number): number => Math.round(n * 10) / 10;

/** Drops float noise (0.30000000000000004) and `-0`. */
const compact = (n: number): string => String(Number(n.toPrecision(12)) + 0);

const checkRange = (name: string, [min, max]: Range): void => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min)
    throw new Error(
      `plane() needs a finite ${name} range with max above min, got [${min}, ${max}].`,
    );
};

const ticksIn = (name: string, [min, max]: Range, step: number): number[] => {
  if (!(step > 0) || !Number.isFinite(step))
    throw new Error(`plane() needs a positive ${name} tick step, got ${step}.`);

  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);

  if (last - first + 1 > MAX_TICKS)
    throw new Error(
      `plane() would draw ${last - first + 1} ${name} ticks. Raise the step ${step} to draw at most ${MAX_TICKS}.`,
    );

  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => (first + i) * step);
};

const isStep = (ticks: FrameOptions["ticks"]): ticks is number => typeof ticks === "number";

/** Checks the options and works out the frame every drawing shares. */
export function frameOf(options: FrameOptions): Frame {
  const { x, y, width, height, at = { x: 0, y: 0 }, theme, fontSize = 12, font } = options;

  checkRange("x", x);
  checkRange("y", y);

  if (!(width > 0) || !(height > 0) || !Number.isFinite(width + height))
    throw new Error(`plane() needs a positive width and height, got ${width} and ${height}.`);

  if (!Number.isFinite(at.x + at.y))
    throw new Error(`plane() needs a finite at, got (${at.x}, ${at.y}).`);

  if (!(fontSize > 0)) throw new Error(`plane() needs a positive fontSize, got ${fontSize}.`);

  const ticks = isStep(options.ticks)
    ? { x: options.ticks, y: options.ticks }
    : (options.ticks ?? {});

  const [xSpan, ySpan] = [x[1] - x[0], y[1] - y[0]];

  const point = (gx: number, gy: number): Point => ({
    x: at.x + ((gx - x[0]) / xSpan) * width,
    y: at.y + height - ((gy - y[0]) / ySpan) * height,
  });

  return {
    x,
    y,
    bounds: rect(at.x, at.y, width, height),
    sx: width / xSpan,
    sy: height / ySpan,
    point,
    origin: point(0, 0),
    cross: [x[0] <= 0 && x[1] >= 0 ? 0 : x[0], y[0] <= 0 && y[1] >= 0 ? 0 : y[0]],
    xs: ticks.x === undefined ? [] : ticksIn("x", x, ticks.x),
    ys: ticks.y === undefined ? [] : ticksIn("y", y, ticks.y),
    labels: options.labels ?? true,
    grid: options.grid ?? false,
    theme,
    fontSize,
    font,
    clip: def.clipPath({}, el.rect({ x: at.x, y: at.y, width, height })),
  };
}

const lineOf = (frame: Frame, x1: number, y1: number, x2: number, y2: number, strokeWidth = 1) =>
  el.line({ x1, y1, x2, y2, stroke: tint(frame.theme, "comment"), strokeWidth });

/** Faint lines across the plot at the ticks. */
export function faintGrid(frame: Frame): SvgNode {
  const { bounds, xs, ys, point } = frame;

  return el.g({ strokeOpacity: 0.25 }, [
    ...xs.map((v) => lineOf(frame, point(v, 0).x, bounds.y, point(v, 0).x, bounds.y + bounds.h)),
    ...ys.map((v) => lineOf(frame, bounds.x, point(0, v).y, bounds.x + bounds.w, point(0, v).y)),
  ]);
}

/** The axis lines, their ticks and the numbers at them, drawn at rest. */
export function furniture(frame: Frame): SvgNode {
  const { bounds, xs, ys, point, cross, fontSize, font } = frame;
  const { x, y } = point(cross[0], cross[1]);
  const labelColor = tint(frame.theme, "muted");
  const zeroInY = frame.y[0] <= 0 && frame.y[1] >= 0;

  const line = (x1: number, y1: number, x2: number, y2: number, strokeWidth?: number) =>
    lineOf(frame, x1, y1, x2, y2, strokeWidth);

  const text = (tx: number, ty: number, anchor: "middle" | "end", value: number) =>
    el.text(
      { x: tx, y: ty, fontSize, textAnchor: anchor, fill: labelColor, fontFamily: font },
      compact(value),
    );

  return el.g({}, [
    frame.grid ? faintGrid(frame) : undefined,
    line(bounds.x, y, bounds.x + bounds.w, y, 1.5),
    line(x, bounds.y, x, bounds.y + bounds.h, 1.5),
    ...xs.map((v) => line(point(v, 0).x, y - TICK, point(v, 0).x, y + TICK)),
    ...ys.map((v) => line(x - TICK, point(0, v).y, x + TICK, point(0, v).y)),
    frame.labels
      ? [
          ...xs.map((v) => text(point(v, 0).x, y + TICK + fontSize, "middle", v)),
          ...ys
            .filter((v) => !(v === 0 && zeroInY))
            .map((v) => text(x - TICK - 3, point(0, v).y + fontSize * 0.35, "end", v)),
        ]
      : undefined,
  ]);
}

export interface SampleOptions {
  /** Points sampled across `from`..`to`. Default 200. */
  readonly samples?: number;
  /** Default the x range. */
  readonly from?: number;
  readonly to?: number;
  /** Default the theme's blue. */
  readonly color?: Paint;
  readonly strokeWidth?: number;
}

export interface Curve {
  /** The runs of the curve in graph units. A gap, or a jump taller than the range, starts a new run. */
  readonly runs: readonly (readonly (readonly [number, number])[])[];
  readonly d: string;
  readonly points: readonly Point[];
}

/** `f` sampled across the range. Past one plot height outside it a point is dropped, and so is a jump taller than the range. */
export function sample(frame: Frame, f: (x: number) => number, options: SampleOptions): Curve {
  const { samples = 200, from = frame.x[0], to = frame.x[1] } = options;

  if (!Number.isInteger(samples) || samples < 2)
    throw new Error(`plot() needs a whole number of samples, at least 2, got ${samples}.`);

  if (!Number.isFinite(from + to) || to <= from)
    throw new Error(`plot() needs from below to, got from ${from} and to ${to}.`);

  const ySpan = frame.y[1] - frame.y[0];
  const [low, high] = [frame.y[0] - ySpan, frame.y[1] + ySpan];
  const runs: (readonly [number, number])[][] = [];
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

    const p = frame.point(gx, gy);
    const [rx, ry] = [round(p.x), round(p.y)];
    const joined = previous !== undefined && Math.abs(gy - previous) <= ySpan;

    if (joined) runs.at(-1)!.push([gx, gy]);
    else runs.push([[gx, gy]]);

    d += `${joined ? "L" : "M"}${rx} ${ry}`;
    points.push({ x: rx, y: ry });
    previous = gy;
  }

  if (points.length === 0)
    throw new Error(`plot() found no finite values inside the y range between ${from} and ${to}.`);

  return { runs, d, points };
}
