import { area as d3area, curveLinear, curveMonotoneX, curveStep, line as d3line } from "d3-shape";
import {
  def,
  draw,
  ease,
  el,
  enter,
  motion,
  rect,
  type Color,
  type Point,
  type Rect,
  type SvgNode,
} from "svjeez";
import { tint, type Base16 } from "svjeez/extras";
import type {
  Area,
  AreaOptions,
  Bar,
  Bars,
  BarsOptions,
  Curve,
  FontAttr,
  Line,
  LineOptions,
  Timing,
} from "./types.ts";

/** What a series needs to know about the chart it joins. */
export interface Frame {
  readonly bounds: Rect;
  readonly theme: Base16;
  readonly fontSize: number;
  readonly font: FontAttr | undefined;
  readonly bandwidth: number;
  /** The band categories, or undefined on a linear scale. */
  readonly categories: readonly string[] | undefined;
  /** The niced domains. `xDomain` is undefined on a band scale. */
  readonly xDomain: readonly [number, number] | undefined;
  readonly yDomain: readonly [number, number];
  x(value: string | number): number;
  y(value: number): number;
  yFormat(value: number): string;
  nextColor(): Color;
}

type Raw = readonly (readonly [string | number, number])[];

export const round = (n: number): number => Math.round(n * 10) / 10;

const CURVES = { linear: curveLinear, monotone: curveMonotoneX, step: curveStep } as const;

const curveOf = (what: string, curve: Curve = "linear") => {
  if (!(curve in CURVES))
    throw new Error(`${what} needs curve "linear", "monotone" or "step", got "${curve}".`);

  return CURVES[curve];
};

const EPSILON = 1e-9;

const within = (v: number, [low, high]: readonly [number, number]): boolean => {
  const slack = (high - low) * EPSILON;

  return v >= low - slack && v <= high + slack;
};

const timing = (what: string, { at = 0, over }: Timing, fallback: number) => {
  const length = over ?? fallback;

  if (!Number.isFinite(at) || at < 0)
    throw new Error(`${what} needs an at of 0 or later, got ${at}.`);

  if (!Number.isFinite(length) || length <= 0)
    throw new Error(`${what} needs a positive over, got ${length}.`);

  return { at, over: length };
};

export function buildSeries(f: Frame) {
  const { theme, fontSize, font, bounds } = f;
  const ink = tint(theme, "plain");
  const bottom = bounds.y + bounds.h;

  const baselineOf = (value: number): number => {
    const [low, high] = f.yDomain;

    return f.y(Math.min(Math.max(value, low), high));
  };

  const place = (what: string, points: Raw): Point[] => {
    if (points.length < 2)
      throw new Error(`${what} needs at least 2 points, got ${points.length}.`);

    return points.map(([x, y], i) => {
      if (!Number.isFinite(y) || (f.categories === undefined && !Number.isFinite(x)))
        throw new Error(`${what} needs finite values, got [${x}, ${y}] at index ${i}.`);

      if (f.categories && !f.categories.includes(String(x)))
        throw new Error(
          `${what} got "${x}" at index ${i}, which is not in the x domain (${f.categories.join(", ")}). Add it to x.domain.`,
        );

      const outside =
        !within(y, f.yDomain) || (f.xDomain !== undefined && !within(Number(x), f.xDomain));

      if (outside)
        throw new Error(
          `${what} got [${x}, ${y}] at index ${i}, outside the chart (y spans [${f.yDomain.join(", ")}]${
            f.xDomain ? `, x spans [${f.xDomain.join(", ")}]` : ""
          }). Pass the data to chart({ data }) or widen the domain.`,
        );

      return { x: round(f.x(x)), y: round(f.y(y)) };
    });
  };

  const clipTo = (box: Rect) =>
    def.clipPath({}, el.rect({ x: box.x, y: box.y, width: box.w, height: box.h }));

  function bars(values: Readonly<Record<string, number>>, options: BarsOptions = {}): Bars {
    const { stagger = 0.08, radius = 3, group = { index: 0, count: 1 } } = options;
    const { at, over } = timing("bars()", options, 0.7);
    const categories = f.categories;

    if (categories === undefined)
      throw new Error("bars() needs a band x scale, got a linear one. Use line() or area() here.");

    if (!Number.isFinite(stagger) || stagger < 0)
      throw new Error(`bars() needs a stagger of 0 or more, got ${stagger}.`);

    if (
      !Number.isInteger(group.count) ||
      group.count < 1 ||
      !Number.isInteger(group.index) ||
      group.index < 0 ||
      group.index >= group.count
    )
      throw new Error(
        `bars() needs group.index below group.count, got ${group.index} of ${group.count}.`,
      );

    const entries = Object.entries(values);

    if (entries.length === 0) throw new Error("bars() needs at least one value, got none.");

    for (const [key, value] of entries) {
      if (!categories.includes(key))
        throw new Error(
          `bars() got "${key}", which is not in the x domain (${categories.join(", ")}). Add it to x.domain.`,
        );

      if (!Number.isFinite(value))
        throw new Error(`bars() needs finite values, got ${value} for "${key}".`);

      if (!within(value, f.yDomain))
        throw new Error(
          `bars() got ${value} for "${key}", outside the y domain [${f.yDomain.join(", ")}]. Pass the data to chart({ data }) or widen y.domain.`,
        );
    }

    const color = options.color ?? f.nextColor();
    const zero = baselineOf(0);
    const gap = group.count > 1 ? 2 : 0;
    const slot = f.bandwidth / group.count;
    const barWidth = Math.max(1, slot - gap);
    const radiusPx = Math.min(radius, barWidth / 2);

    // A bar is drawn radius px longer than it shows, and a clip at the baseline trims that end square.
    const above = clipTo(rect(bounds.x, bounds.y, bounds.w, zero - bounds.y));
    const below = clipTo(rect(bounds.x, zero, bounds.w, bottom - zero));
    const format = options.values === true ? f.yFormat : options.values || undefined;

    const placed: Bar[] = [];
    const rising: SvgNode[] = [];
    const falling: SvgNode[] = [];
    const labels: SvgNode[] = [];
    let end = at;

    categories
      .filter((key) => key in values)
      .forEach((key, i) => {
        const value = values[key]!;
        const start = at + i * stagger;
        const x = round(f.x(key) - f.bandwidth / 2 + group.index * slot + gap / 2);
        const tip = round(f.y(value));
        const length = Math.abs(zero - tip);
        const up = value >= 0;
        const long = length + radiusPx;

        end = Math.max(end, start + over);
        placed.push({ key, value, bounds: rect(x, Math.min(tip, zero), barWidth, length) });

        const grow = up ? motion({ height: 0, y: long }) : motion({ height: 0 });
        const to = up ? { height: long, y: 0 } : { height: long };

        (up ? rising : falling).push(
          el.rect({
            x,
            y: round(up ? tip : zero - radiusPx),
            width: barWidth,
            height: round(long),
            rx: radiusPx,
            fill: color,
            animation: grow.at(start).to(to, over, ease.out),
          }),
        );

        if (format)
          labels.push(
            el.text(
              {
                x: round(x + barWidth / 2),
                y: round(up ? tip - 6 : tip + fontSize + 2),
                fontSize,
                textAnchor: "middle",
                fill: ink,
                fontFamily: font,
                animation: enter(
                  { at: start + over * 0.6, over: 0.35 },
                  { opacity: 0, y: up ? 4 : -4 },
                ),
              },
              format(value),
            ),
          );
      });

    return {
      node: el.g({}, [
        rising.length ? el.g({ clipPath: above }, rising) : undefined,
        falling.length ? el.g({ clipPath: below }, falling) : undefined,
        labels,
      ]),
      bars: placed,
      end,
    };
  }

  /** The line, its dots and its label. Dots appear as the stroke reaches them, which a linear draw makes proportional to length. */
  function trace(
    what: string,
    points: Point[],
    options: LineOptions,
    color: Color,
    { at, over }: { at: number; over: number },
    stroked = true,
  ) {
    const d = d3line<Point>()
      .x((p) => p.x)
      .y((p) => p.y)
      .curve(curveOf(what, options.curve))
      .digits(1)(points);

    if (d === null)
      throw new Error(`${what} could not draw a path through ${points.length} points.`);

    const strokeWidth = options.strokeWidth ?? 2.5;
    const radius = options.dots === true ? 4 : options.dots || 0;

    const reached = points.reduce<number[]>((sums, p, i) => {
      const prev = points[i - 1];
      sums.push((sums[i - 1] ?? 0) + (prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0));

      return sums;
    }, []);

    const total = reached.at(-1) || 1;
    const last = points.at(-1)!;

    const node = el.g({}, [
      stroked
        ? el.path({
            d,
            fill: "none",
            stroke: color,
            strokeWidth,
            strokeLinejoin: "round",
            strokeLinecap: "round",
            animation: draw({ at, over }, ease.linear),
          })
        : undefined,
      radius > 0
        ? points.map((p, i) =>
            el.circle({
              cx: p.x,
              cy: p.y,
              r: radius,
              fill: color,
              stroke: theme.base00,
              strokeWidth: 2,
              animation: enter(
                { at: at + (over * reached[i]!) / total, over: 0.3 },
                { scale: 0 },
                ease.pop,
              ),
            }),
          )
        : undefined,
      options.label
        ? el.text(
            {
              x: round(last.x + (radius || strokeWidth) + 8),
              y: round(last.y + fontSize * 0.35),
              fontSize,
              fill: color,
              fontFamily: font,
              animation: enter({ at: at + over, over: 0.4 }, { opacity: 0, x: -8 }),
            },
            options.label,
          )
        : undefined,
    ]);

    return { d, node };
  }

  function line(points: Raw, options: LineOptions = {}): Line {
    const span = timing("line()", options, 1.2);
    const placed = place("line()", points);
    const { d, node } = trace("line()", placed, options, options.color ?? f.nextColor(), span);

    return { node, d, points: placed, end: span.at + span.over + (options.label ? 0.4 : 0) };
  }

  function area(points: Raw, options: AreaOptions = {}): Area {
    const span = timing("area()", options, 1.2);
    const { at, over } = span;
    const placed = place("area()", points);
    const color = options.color ?? f.nextColor();

    if (options.baseline !== undefined && !Number.isFinite(options.baseline))
      throw new Error(`area() needs a finite baseline, got ${options.baseline}.`);

    const base = baselineOf(options.baseline ?? 0);

    const fill = d3area<Point>()
      .x((p) => p.x)
      .y0(round(base))
      .y1((p) => p.y)
      .curve(curveOf("area()", options.curve))
      .digits(1)(placed);

    if (fill === null)
      throw new Error(`area() could not draw a shape through ${placed.length} points.`);

    const shade = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, [
      el.stop({ offset: 0, stopColor: color, stopOpacity: 0.4 }),
      el.stop({ offset: 1, stopColor: color, stopOpacity: 0 }),
    ]);

    const wipe = def.clipPath(
      {},
      el.rect({
        x: bounds.x,
        y: bounds.y,
        width: bounds.w,
        height: bounds.h,
        animation: motion({ width: 0 }).at(at).to({ width: bounds.w }, over, ease.linear),
      }),
    );

    const { d, node } = trace("area()", placed, options, color, span, options.line !== false);

    return {
      node: el.g({}, [el.g({ clipPath: wipe }, el.path({ d: fill, fill: shade })), node]),
      d,
      fill,
      points: placed,
      end: at + over + (options.label ? 0.4 : 0),
    };
  }

  return { bars, line, area };
}
