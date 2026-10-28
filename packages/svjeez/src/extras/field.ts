import type { Color } from "../attributes";
import { el } from "../el";
import type { Point } from "../geometry";
import { num } from "../format";
import { ease, motion, type Motion, type Seconds } from "../motion";
import { matchPaths } from "../paths";
import { draw } from "../recipes";
import type { SvgNode } from "../svg";
import { marchingSquares } from "../layout/contour";
import { simplify, traceStreamlines, type VectorField } from "../layout/field";
import type { Axes } from "./axes";
import { flow } from "./flow";
import { defaultDark, tint, type Base16 } from "./theme";

export type { VectorField };

/** A region of the scene in px. A `Rect`, such as `axes().bounds`, fits. */
export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const round = (n: number): number => Math.round(n * 10) / 10;

const pathOf = (points: readonly Point[], closed = false): string =>
  `${points.map((p, i) => `${i ? "L" : "M"}${num(round(p.x))} ${num(round(p.y))}`).join("")}${closed ? "Z" : ""}`;

const positive = (what: string, name: string, n: number): void => {
  if (!(n > 0) || !Number.isFinite(n))
    throw new Error(`${what} needs a positive ${name}, got ${n}.`);
};

const checkBounds = (what: string, { x, y, w, h }: Bounds): void => {
  if (!Number.isFinite(x + y + w + h) || !(w > 0) || !(h > 0))
    throw new Error(`${what} needs bounds with a positive w and h, got ${w} by ${h}.`);
};

export interface StreamlinesOptions {
  /** The region to fill, in scene px. `axes().bounds` fits. */
  readonly bounds: Bounds;
  /** Gap between neighbouring lines in px. Default 24. */
  readonly spacing?: number;
  /** Trace from exactly these points and do not fill the gaps. */
  readonly seeds?: readonly Point[];
  /** Integration step in px. Default 2. */
  readonly step?: number;
  /** Longest a line may run, in px. Default 900. */
  readonly maxLength?: number;
  /** Shorter lines are dropped. Default the spacing. */
  readonly minLength?: number;
  /** How far, in px, a line may stray from the traced points when simplified. Default 0.25. */
  readonly tolerance?: number;
}

export interface Streamlines {
  /** Each line as points in scene px, running with the field. Hand one to `flow()`. */
  readonly lines: readonly (readonly Point[])[];
  /** Every line as one path data string, a subpath each. */
  readonly d: string;
}

/**
 * Evenly spaced streamlines of `field`, the curves that follow its arrows. `field(x, y)` takes scene px and gives
 * `[u, v]`, with y growing down the page. Only the direction matters; the length of the arrow does not.
 * Lines start at the middle of `bounds` and fill outward, so earlier lines are the ones nearest the middle.
 */
export function streamlines(field: VectorField, options: StreamlinesOptions): Streamlines {
  const { bounds, spacing = 24, step = 2, maxLength = 900, tolerance = 0.25 } = options;

  checkBounds("streamlines()", bounds);
  positive("streamlines()", "spacing", spacing);
  positive("streamlines()", "step", step);
  positive("streamlines()", "maxLength", maxLength);

  const traced = traceStreamlines(field, {
    bounds,
    spacing,
    step,
    maxLength,
    minLength: options.minLength ?? spacing,
    seeds: options.seeds,
  });

  const lines = traced.map((line) =>
    simplify(line, tolerance).map((p) => ({ x: round(p.x), y: round(p.y) })),
  );

  return { lines, d: lines.map((line) => pathOf(line)).join("") };
}

export interface FieldLinesOptions {
  readonly at: Seconds;
  /** Seconds from the first line starting to the last one finishing. */
  readonly over: Seconds;
  /** Seconds one line takes to draw. Default a third of `over`. */
  readonly each?: Seconds;
  /** Default the theme's `comment` color. */
  readonly color?: Color;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly theme?: Base16;
}

/** The lines as paths that draw on one after another, nearest the middle first. */
export function fieldLines(
  lines: readonly (readonly Point[])[],
  options: FieldLinesOptions,
): SvgNode {
  const { at, over, theme = defaultDark, strokeWidth = 1.25, opacity = 0.6 } = options;
  const each = options.each ?? over / 3;

  positive("fieldLines()", "over", over);
  positive("fieldLines()", "each", each);

  return el.g(
    { fill: "none", stroke: options.color ?? tint(theme, "comment"), strokeOpacity: opacity },
    lines.map((line, i) =>
      el.path({
        d: pathOf(line),
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        animation: draw(
          {
            at: at + (lines.length > 1 ? (i / (lines.length - 1)) * Math.max(0, over - each) : 0),
            over: each,
          },
          ease.inOut,
        ),
      }),
    ),
  );
}

export interface FieldFlowOptions {
  /** When the particles appear. Each line then starts at its own point in its cycle. */
  readonly at: Seconds;
  /** px/s along every line. Default 120. */
  readonly speed?: number;
  /** `dot` is one animated element per line, `comet` adds a short tail (a few more). Default `dot`. */
  readonly style?: "dot" | "comet";
  /** Seconds a particle waits between trips. Default 0.4 of the length of its trip. */
  readonly rest?: Seconds;
  /** px a particle may stray from its line, which keeps the keyframes few. Default 1. */
  readonly tolerance?: number;
  /** Default the theme's orange. */
  readonly color?: Color;
  readonly size?: number;
  readonly theme?: Base16;
}

/** Same as the golden angle on a circle: consecutive indices land far apart, and the sequence never repeats. */
const GOLDEN = 0.6180339887498949;

const lengthOf = (points: readonly Point[]): number =>
  points
    .slice(1)
    .reduce((sum, p, k) => sum + Math.hypot(p.x - points[k]!.x, p.y - points[k]!.y), 0);

/** The line cut `distance` along its length: the point of the cut belongs to both halves. */
const cut = (points: readonly Point[], distance: number): [Point[], Point[]] => {
  let left = distance;

  for (let k = 1; k < points.length; k++) {
    const [a, b] = [points[k - 1]!, points[k]!];
    const leg = Math.hypot(b.x - a.x, b.y - a.y);

    if (left <= leg && leg > 0) {
      const t = left / leg;
      const mid = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };

      return [
        [...points.slice(0, k), mid],
        [mid, ...points.slice(k)],
      ];
    }

    left -= leg;
  }

  return [[...points], [points.at(-1)!]];
};

/**
 * One particle per line, each running its line again and again. Every line has its own length and so its own period,
 * and the particle starts a different way along it, set by the line's index, so the field flows without pulsing in
 * unison. A particle that starts part way runs as two pieces, so a comet's tail is cut where its line starts over.
 * Costs one or two animated elements per line for `dot`, four to eight for `comet`.
 */
export function fieldFlow(
  lines: readonly (readonly Point[])[],
  options: FieldFlowOptions,
): SvgNode {
  const { at, speed = 120, style = "dot", theme = defaultDark, tolerance = 1 } = options;
  const tail = style === "comet" ? 3 : 0;
  const reach = style === "comet" ? 36 / speed : 0;

  positive("fieldFlow()", "speed", speed);

  return el.g(
    { animation: motion({ opacity: 0 }).at(at).to({ opacity: 1 }, 0.6) },
    lines.flatMap((line, i) => {
      const points = simplify(line, tolerance);
      const length = lengthOf(points);

      if (!(length > 0)) return [];

      const trip = length / speed;
      const rest = options.rest ?? trip * 0.4;
      const period = trip + reach + rest;
      const [ahead, behind] = cut(points, (((i + 1) * GOLDEN) % 1) * length);

      const piece = (part: readonly Point[], start: Seconds) =>
        lengthOf(part) > 0
          ? [
              flow(part, {
                at: start,
                over: lengthOf(part) / speed,
                loop: period,
                style,
                tail: tail || undefined,
                color: options.color,
                theme,
                size: options.size ?? 2.5,
              }).node,
            ]
          : [];

      return [...piece(ahead, 0), ...piece(behind, lengthOf(ahead) / speed + rest)];
    }),
  );
}

export interface VectorFieldOptions {
  readonly bounds: Bounds;
  /** Gap between arrows in px. Default 28. */
  readonly spacing?: number;
  /** px of arrow per unit of field length. Default fits the longest arrow to 0.85 of the spacing. */
  readonly scale?: number;
  /** Give every arrow the same length, so only direction shows. */
  readonly normalize?: boolean;
}

export interface FieldArrow {
  /** The arrow's tail and tip in scene px. */
  readonly from: Point;
  readonly to: Point;
  /** The field's length there, in its own units. */
  readonly magnitude: number;
}

export interface VectorFieldResult {
  /** All arrows as one path: shaft and open head each. Stroke it with round caps. */
  readonly d: string;
  readonly arrows: readonly FieldArrow[];
}

/** A grid of arrows for `field`, centered on its lattice points, as one path. A zero or non-finite field draws nothing. */
export function vectorField(field: VectorField, options: VectorFieldOptions): VectorFieldResult {
  const { bounds, spacing = 28 } = options;

  checkBounds("vectorField()", bounds);
  positive("vectorField()", "spacing", spacing);

  const columns = Math.max(1, Math.floor(bounds.w / spacing));
  const rows = Math.max(1, Math.floor(bounds.h / spacing));

  const [x0, y0] = [
    bounds.x + (bounds.w - (columns - 1) * spacing) / 2,
    bounds.y + (bounds.h - (rows - 1) * spacing) / 2,
  ];

  const samples = Array.from({ length: columns * rows }, (_, k) => {
    const p = { x: x0 + (k % columns) * spacing, y: y0 + Math.floor(k / columns) * spacing };
    const [u, v] = field(p.x, p.y);

    return { p, u, v, magnitude: Math.hypot(u, v) };
  }).filter((s) => s.magnitude > 0 && Number.isFinite(s.magnitude));

  const longest = Math.max(0, ...samples.map((s) => s.magnitude));
  const scale = options.scale ?? (longest > 0 ? (spacing * 0.85) / longest : 1);

  positive("vectorField()", "scale", scale);

  const arrows = samples.map(({ p, u, v, magnitude }): FieldArrow => {
    const length = options.normalize ? spacing * 0.7 : magnitude * scale;
    const [dx, dy] = [(u / magnitude) * length, (v / magnitude) * length];

    return {
      from: { x: p.x - dx / 2, y: p.y - dy / 2 },
      to: { x: p.x + dx / 2, y: p.y + dy / 2 },
      magnitude,
    };
  });

  const d = arrows
    .map(({ from, to }) => {
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const head = Math.min(6, length * 0.4);
      const angle = Math.atan2(to.y - from.y, to.x - from.x);

      const wing = (side: number): Point => ({
        x: to.x - head * Math.cos(angle + side * 0.45),
        y: to.y - head * Math.sin(angle + side * 0.45),
      });

      return `${pathOf([from, to])}${pathOf([wing(1), to, wing(-1)])}`;
    })
    .join("");

  return { d, arrows };
}

export interface SlopeFieldOptions {
  /** Distance between marks along x in graph units. Default a twentieth of the x range. */
  readonly step?: number;
  /** Distance along y in graph units. Default `step`, or a twentieth of the y range. */
  readonly stepY?: number;
  /** Length of a mark in px. Default 0.6 of the nearer neighbour. */
  readonly length?: number;
}

export interface SlopeFieldResult {
  readonly d: string;
}

/** Graph units to px and back, read from the axes' own mapping. */
const frame = (axes: Axes) => {
  const origin = axes.point(0, 0);
  const [ex, ey] = [axes.point(1, 0), axes.point(0, 1)];
  const [sx, sy] = [ex.x - origin.x, ey.y - origin.y];

  return {
    sx,
    sy,
    graph: (p: Point): [number, number] => [(p.x - origin.x) / sx, (p.y - origin.y) / sy],
  };
};

/** Short marks along dy/dx = `f(x, y)` over the axes' range. Where `f` is not finite no mark is drawn; at infinity, the mark is vertical. */
export function slopeField(
  f: (x: number, y: number) => number,
  axes: Axes,
  options: SlopeFieldOptions = {},
): SlopeFieldResult {
  const { bounds } = axes;
  const { sx, sy, graph } = frame(axes);

  const [xa, ya] = [
    graph({ x: bounds.x, y: bounds.y + bounds.h }),
    graph({ x: bounds.x + bounds.w, y: bounds.y }),
  ];

  const xs = options.step ?? (ya[0] - xa[0]) / 20;
  const ys = options.stepY ?? options.step ?? (ya[1] - xa[1]) / 20;

  positive("slopeField()", "x step", xs);
  positive("slopeField()", "y step", ys);

  const length = options.length ?? 0.6 * Math.min(xs * Math.abs(sx), ys * Math.abs(sy));
  const marks: string[] = [];

  for (let gx = Math.ceil(xa[0] / xs - 1e-9) * xs; gx <= ya[0] + 1e-9; gx += xs)
    for (let gy = Math.ceil(xa[1] / ys - 1e-9) * ys; gy <= ya[1] + 1e-9; gy += ys) {
      const slope = f(gx, gy);

      if (Number.isNaN(slope)) continue;

      const [dx, dy] = Number.isFinite(slope) ? [sx, sy * slope] : [0, Math.sign(slope) * -1];
      const m = Math.hypot(dx, dy);
      const c = axes.point(gx, gy);
      const [hx, hy] = [(dx / m) * (length / 2), (dy / m) * (length / 2)];

      marks.push(
        pathOf([
          { x: c.x - hx, y: c.y - hy },
          { x: c.x + hx, y: c.y + hy },
        ]),
      );
    }

  return { d: marks.join("") };
}

export interface SolutionOptions {
  /** Graph x to integrate to, either side of the start. Default the edges of the plot. */
  readonly from?: number;
  readonly to?: number;
  /** Step in graph x. Default a four-hundredth of the plot's range. */
  readonly step?: number;
}

export interface SlopeSolution {
  readonly points: readonly Point[];
  readonly d: string;
}

/** The curve through `start` that follows `slopeField(f, axes)`, by Runge-Kutta, as points in scene px and as path data. */
export function slopeSolution(
  f: (x: number, y: number) => number,
  axes: Axes,
  start: Point,
  options: SolutionOptions = {},
): SlopeSolution {
  const { bounds } = axes;
  const { graph } = frame(axes);
  const [left, top] = graph({ x: bounds.x, y: bounds.y });
  const [right, bottom] = graph({ x: bounds.x + bounds.w, y: bounds.y + bounds.h });
  const [lo, hi] = [options.from ?? left, options.to ?? right];
  const h = options.step ?? (right - left) / 400;
  const [yMin, yMax] = [Math.min(top, bottom), Math.max(top, bottom)];
  const span = yMax - yMin;

  positive("slopeSolution()", "step", h);

  const run = (sign: 1 | -1): [number, number][] => {
    const out: [number, number][] = [];
    let [x, y] = [start.x, start.y];

    for (let n = 0; n < 4000 && x >= lo - 1e-9 && x <= hi + 1e-9; n++) {
      const s = sign * h;
      const k1 = f(x, y);
      const k2 = f(x + s / 2, y + (s * k1) / 2);
      const k3 = f(x + s / 2, y + (s * k2) / 2);
      const k4 = f(x + s, y + s * k3);

      [x, y] = [x + s, y + (s * (k1 + 2 * k2 + 2 * k3 + k4)) / 6];

      if (!Number.isFinite(y) || y < yMin - span || y > yMax + span) break;
      out.push([x, y]);
    }

    return out;
  };

  const points = [...run(-1).reverse(), [start.x, start.y] as const, ...run(1)].flatMap(([x, y]) =>
    x! >= lo - 1e-9 && x! <= hi + 1e-9 && y! >= yMin - span && y! <= yMax + span
      ? [axes.point(x!, y!)]
      : [],
  );

  return { points, d: pathOf(points) };
}

export interface Grid {
  readonly cols: number;
  readonly rows: number;
  /** Row-major, `cols * rows` samples. Row 0 is the top of the bounds, and the outer samples sit on its edges. */
  readonly values: ArrayLike<number>;
}

export interface ContourOptions {
  readonly levels: readonly number[];
  /** Scene px to sample over. Needed unless `axes` is given. */
  readonly bounds?: Bounds;
  /** Sample over this plot, calling the function in graph units rather than px. */
  readonly axes?: Axes;
  /** px between samples of a function. Default 4. Finer costs time, not file size. */
  readonly resolution?: number;
  /** How far, in px, the drawn line may stray from the traced one. Default 0.2. */
  readonly tolerance?: number;
}

export interface ContourLine {
  readonly points: readonly Point[];
  /** The last point joins the first. */
  readonly closed: boolean;
}

export interface ContourLevel {
  readonly level: number;
  readonly lines: readonly ContourLine[];
  /** The level's lines as one path. Fill it with `fillRule="evenodd"` or stroke it. */
  readonly d: string;
}

const isGrid = (source: ((x: number, y: number) => number) | Grid): source is Grid =>
  "cols" in source;

interface Sampled {
  readonly grid: Grid;
  readonly bounds: Bounds;
}

const gridOf = (
  what: string,
  source: ((x: number, y: number) => number) | Grid,
  options: Omit<ContourOptions, "levels">,
): Sampled => {
  const bounds = options.bounds ?? options.axes?.bounds;

  if (!bounds) throw new Error(`${what} needs bounds or axes to place the samples.`);

  checkBounds(what, bounds);

  if (isGrid(source)) {
    if (source.cols < 2 || source.rows < 2 || source.values.length !== source.cols * source.rows)
      throw new Error(
        `${what} needs a grid of at least 2 by 2 with cols * rows values, got ${source.cols} by ${source.rows} with ${source.values.length}.`,
      );

    return { grid: source, bounds };
  }

  const resolution = options.resolution ?? 4;

  positive(what, "resolution", resolution);

  const [cols, rows] = [Math.ceil(bounds.w / resolution) + 1, Math.ceil(bounds.h / resolution) + 1];
  const graph = options.axes ? frame(options.axes).graph : undefined;
  const values = new Float64Array(cols * rows);

  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const p = {
        x: bounds.x + (i / (cols - 1)) * bounds.w,
        y: bounds.y + (j / (rows - 1)) * bounds.h,
      };

      const [x, y] = graph ? graph(p) : [p.x, p.y];

      values[j * cols + i] = source(x, y);
    }

  return { grid: { cols, rows, values }, bounds };
};

const levelOf = (grid: Grid, bounds: Bounds, level: number, tolerance: number): ContourLevel => {
  const lines = marchingSquares(grid.values, grid.cols, grid.rows, level).map(
    ({ points, closed }) => {
      const placed = points.map((p) => ({
        x: bounds.x + (p.x / (grid.cols - 1)) * bounds.w,
        y: bounds.y + (p.y / (grid.rows - 1)) * bounds.h,
      }));

      const ring = closed ? [...placed, placed[0]!] : placed;
      const kept = simplify(ring, tolerance);

      return { points: closed ? kept.slice(0, -1) : kept, closed };
    },
  );

  return {
    level,
    lines,
    d: lines.map((line) => pathOf(line.points, line.closed)).join(""),
  };
};

/**
 * Level lines of a scalar field: where `source` crosses each of `levels`. `source` is a function of `(x, y)`, in graph
 * units with `axes` and in scene px with `bounds`, or a `Grid` of samples you computed. Use it for implicit curves
 * (`x*x + y*y - 1` at level 0) and for elevation lines. A line that leaves the bounds ends there.
 */
export function contours(
  source: ((x: number, y: number) => number) | Grid,
  options: ContourOptions,
): ContourLevel[] {
  const { grid, bounds } = gridOf("contours()", source, options);

  return options.levels.map((level) => levelOf(grid, bounds, level, options.tolerance ?? 0.2));
}

export interface ContourSweepOptions extends Omit<ContourOptions, "levels"> {
  readonly from: number;
  readonly to: number;
  readonly at: Seconds;
  readonly over: Seconds;
  /** Levels sampled between `from` and `to`. Default 16. More follow the curves closer and cost more keys. */
  readonly frames?: number;
}

export interface ContourSweep {
  /** The path data at `from`. Give it to `<path d>`. */
  readonly d: string;
  /** Moves the path through every level. Give it to `animation`. */
  readonly animation: Motion<"d">;
}

/**
 * One path whose level line moves from `from` to `to`, as a morph: every frame is written through `matchPaths()`.
 * It reads best while the lines only grow, shrink and bend, like a circle widening. Where loops split or merge, rings
 * pair by order and one grows from a point, so draw a `contours()` level per step instead when that matters.
 */
export function contourSweep(
  source: ((x: number, y: number) => number) | Grid,
  options: ContourSweepOptions,
): ContourSweep {
  const { from, to, at, over, frames = 16 } = options;

  if (!Number.isInteger(frames) || frames < 2)
    throw new Error(`contourSweep() needs a whole number of frames, at least 2, got ${frames}.`);

  positive("contourSweep()", "over", over);

  const { grid, bounds } = gridOf("contourSweep()", source, options);
  const tolerance = options.tolerance ?? 0.4;

  const levels = Array.from({ length: frames }, (_, i) => from + ((to - from) * i) / (frames - 1));

  const drawn = levels.map((level) => {
    const { d } = levelOf(grid, bounds, level, tolerance);

    if (d === "")
      throw new Error(
        `contourSweep() found no line at level ${num(level)}. Sweep levels that all cross the bounds.`,
      );

    return d;
  });

  const matched = matchPaths(drawn, { precision: 1 });
  let track: Motion<"d"> = motion({ d: matched[0]! }).at(at);

  for (const d of matched.slice(1)) track = track.to({ d }, over / (frames - 1), ease.linear);

  return { d: matched[0]!, animation: track };
}
