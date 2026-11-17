import { contours, plane, tex } from "@svjeez/math";
import { tickStep, quantile } from "d3-array";
import { draw, enter, render, span } from "svjeez";
import { rect, type Rect } from "svjeez/geometry";
import { choice, defaults, number, text, type Values } from "svjeez/params";

import {
  HEIGHT,
  MARGIN,
  WIDTH,
  Title,
  color,
  css,
  leave,
  mono,
  theme,
} from "../../../examples/gallery-style";
import { expression, FUNCTIONS, type Expression } from "../expression";

const WINDOW = { min: -1_000_000, max: 1_000_000 };

export const params = {
  title: text("A heart", {
    maxLength: 50,
    label: "The heading above the equation. At most 50 characters.",
  }),
  tex: text(String.raw`x = 16\sin^3 t, \quad y = 13\cos t - 5\cos 2t - 2\cos 3t - \cos 4t`, {
    maxLength: 240,
    label:
      "The equation as it should be typeset, in TeX math mode without dollar signs, such as y = \\frac{\\sin x}{x}. At most 240 characters.",
  }),
  kind: choice("parametric", ["function", "parametric", "polar", "implicit"], {
    label:
      "function for y = f(x); parametric for x(t), y(t); polar for r(theta); implicit for an equation F(x, y) = 0.",
  }),
  expression: text("16*sin(t)^3", {
    maxLength: 300,
    label: `The formula to draw, in plain math syntax (not TeX): * for products, ^ for powers, pi and e, and the functions ${FUNCTIONS}. function: f(x) in x, such as sin(x)/x. parametric: x(t) in t, such as 16*sin(t)^3. polar: r(theta) in theta, such as cos(3*theta). implicit: F(x, y) in x and y, whose zero is the curve, such as (x^2 + y^2 - 1)^3 - x^2*y^3.`,
  }),
  y: text("13*cos(t) - 5*cos(2*t) - 2*cos(3*t) - cos(4*t)", {
    maxLength: 300,
    label:
      "parametric only: y(t) in t, same syntax, such as 13*cos(t) - 5*cos(2*t). Empty for the other kinds.",
  }),
  from: number(0, {
    ...WINDOW,
    label: "parametric and polar: where t or theta starts, such as 0.",
  }),
  to: number(6.2832, {
    ...WINDOW,
    label: "parametric and polar: where t or theta ends; 6.2832 is a full turn (2*pi).",
  }),
  xMin: number(0, {
    ...WINDOW,
    label:
      "The left of the window. Leave xMin and xMax both 0 to fit the curve (for function, x then runs from -10 to 10).",
  }),
  xMax: number(0, { ...WINDOW, label: "The right of the window; see xMin." }),
  yMin: number(0, {
    ...WINDOW,
    label: "The bottom of the window. Leave yMin and yMax both 0 to fit the curve.",
  }),
  yMax: number(0, { ...WINDOW, label: "The top of the window; see yMin." }),
};

type Kind = Values<typeof params>["kind"];

type Range = readonly [number, number];

type Point = readonly [number, number];

const D = 8;
const TEX = { top: 104, size: 30 };
const SAMPLES = 600;
const PAD = 0.08;

const examples: Record<Kind, string> = {
  function: "sin(x)/x",
  parametric: "16*sin(t)^3",
  polar: "cos(3*theta)",
  implicit: "(x^2 + y^2 - 1)^3 - x^2*y^3",
};

const set = ([lo, hi]: Range) => lo !== 0 || hi !== 0;

const padded = ([lo, hi]: Range): Range => {
  const room = (hi - lo || Math.abs(lo) || 1) * PAD;

  return [lo - room, hi + room];
};

const extent = (values: readonly number[]): Range => [Math.min(...values), Math.max(...values)];

/** Ranges that keep one graph unit the same length on both axes, centered on `x` and `y`, filling `frame`. */
const equal = (x: Range, y: Range, frame: Rect): [Range, Range] => {
  const unit = Math.max((x[1] - x[0]) / frame.w, (y[1] - y[0]) / frame.h);
  const [cx, cy] = [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2];

  return [
    [cx - (unit * frame.w) / 2, cx + (unit * frame.w) / 2],
    [cy - (unit * frame.h) / 2, cy + (unit * frame.h) / 2],
  ];
};

/** The y values worth showing: all of them, unless a few run off toward an asymptote. */
const robust = (values: readonly number[]): Range => {
  const sorted = [...values].sort((a, b) => a - b);
  const [low, high] = [quantile(sorted, 0.1) ?? 0, quantile(sorted, 0.9) ?? 0];
  const reach = 1.5 * (high - low || 1);

  return [Math.max(sorted[0]!, low - reach), Math.min(sorted.at(-1)!, high + reach)];
};

const finite = (points: readonly Point[], what: string): Point[] => {
  const kept = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  if (kept.length < 2)
    throw new Error(`${what} has no finite value to draw. Check the formula and the range.`);

  return kept;
};

const samples = (from: number, to: number) =>
  Array.from({ length: SAMPLES }, (_, i) => from + ((to - from) * i) / (SAMPLES - 1));

interface Curve {
  readonly x: Range;
  readonly y: Range;
  readonly equalAspect: boolean;
}

const curveOf = (p: Values<typeof params>, f: Expression, g: Expression | undefined): Curve => {
  const xr: Range = [p.xMin, p.xMax];
  const yr: Range = [p.yMin, p.yMax];

  if (p.kind === "function") {
    const x = set(xr) ? xr : ([-10, 10] as const);

    const points = finite(
      samples(...x).map((at) => [at, f({ x: at })] as const),
      "expression",
    );

    return { x, y: set(yr) ? yr : padded(robust(points.map(([, y]) => y))), equalAspect: false };
  }

  if (p.kind === "implicit") {
    if (set(xr) && set(yr)) return { x: xr, y: yr, equalAspect: true };

    const scan: Range = [-10, 10];
    const frame = rect(0, 0, 400, 400);

    const [level] = contours((x, y) => f({ x, y }), {
      plane: grid(scan, scan, frame),
      levels: [0],
    });

    const points = level?.lines.flatMap((line) => line.points) ?? [];

    if (points.length === 0)
      throw new Error(
        "expression never reaches 0 between -10 and 10, so there is no curve to draw. Check the formula, or set xMin, xMax, yMin and yMax around the curve.",
      );

    const toX = (px: number) => scan[0] + ((px - frame.x) / frame.w) * (scan[1] - scan[0]);
    const toY = (py: number) => scan[1] - ((py - frame.y) / frame.h) * (scan[1] - scan[0]);

    return {
      x: set(xr) ? xr : padded(extent(points.map((point) => toX(point.x)))),
      y: set(yr) ? yr : padded(extent(points.map((point) => toY(point.y)))),
      equalAspect: true,
    };
  }

  if (!(p.to > p.from)) throw new Error(`to (${p.to}) must be above from (${p.from}).`);

  const points = finite(
    samples(p.from, p.to).map((t): Point => {
      if (p.kind === "polar") {
        const r = f({ theta: t, t });

        return [r * Math.cos(t), r * Math.sin(t)];
      }

      return [f({ t }), g?.({ t }) ?? NaN];
    }),
    p.kind === "polar" ? "expression" : "expression and y",
  );

  return {
    x: set(xr) ? xr : padded(extent(points.map(([x]) => x))),
    y: set(yr) ? yr : padded(extent(points.map(([, y]) => y))),
    equalAspect: true,
  };
};

const grid = (x: Range, y: Range, frame: Rect) =>
  plane({
    xRange: x,
    yRange: y,
    frame,
    ticks: { x: tickStep(x[0], x[1], 6), y: tickStep(y[0], y[1], 5) },
    grid: true,
    theme,
    font: mono,
    fontSize: 13,
  });

export default function build(p: Values<typeof params> = defaults(params)): string {
  const f = expression(p.expression, "expression", examples[p.kind]);
  const g = p.kind === "parametric" ? expression(p.y, "y", "13*cos(t) - 5*cos(2*t)") : undefined;
  const measured = tex(p.tex, { fontSize: TEX.size });
  const size = Math.min(TEX.size, (TEX.size * (WIDTH - 2 * MARGIN)) / measured.width);
  const typeset = tex(p.tex, { x: MARGIN, y: TEX.top, fontSize: size, theme });
  const top = TEX.top + typeset.height + 28;
  const room = rect(MARGIN + 40, top, WIDTH - 2 * MARGIN - 40, HEIGHT - MARGIN - 24 - top);
  const curve = curveOf(p, f, g);
  const [x, y] = curve.equalAspect ? equal(curve.x, curve.y, room) : [curve.x, curve.y];
  const traced = { at: 1, over: 2.4 };
  const stroke = { color: color.accent, strokeWidth: 2.5, samples: SAMPLES };

  const shown = (() => {
    const axes = grid(x, y, room);

    if (p.kind === "function")
      return { axes, line: axes.plot(traced, (at) => f({ x: at }), stroke).node };

    if (p.kind === "implicit") {
      const [level] = contours((at, bt) => f({ x: at, y: bt }), { plane: axes, levels: [0] });

      if (!level?.d)
        throw new Error(
          "expression never reaches 0 in the window, so there is no curve to draw. Check the formula, or set xMin, xMax, yMin and yMax around the curve.",
        );

      return {
        axes,
        line: (
          <path
            d={level.d}
            fill="none"
            stroke={color.accent}
            strokeWidth={2.5}
            animation={draw(traced)}
          />
        ),
      };
    }

    const along = { ...stroke, animation: draw(traced) };

    return {
      axes,
      line:
        p.kind === "polar"
          ? axes.polar((t) => f({ theta: t, t }), [p.from, p.to], along).node
          : axes.parametric((t) => [f({ t }), g?.({ t }) ?? NaN], [p.from, p.to], along).node,
    };
  })();

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: p.title,
      desc: `${p.title}: the graph of ${p.tex}, drawn on a coordinate plane.`,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={color.bg} />
      <g animation={leave(D)}>
        <Title title={p.title} />
        <g animation={enter(span(0.3, 0.5))}>{typeset.node}</g>
        <g animation={enter(span(0.5, 0.5))}>{shown.axes.node}</g>
        {shown.line}
      </g>
    </>,
  );
}
