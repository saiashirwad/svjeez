import { scaleBand, scaleLinear } from "d3-scale";
import { el, rect, type Color, type SvgNode } from "svjeez";
import { defaultDark, tint } from "svjeez/extras";
import { buildSeries, round, type Frame } from "./series.ts";
import type { Chart, ChartOptions, Datum, XScale } from "./types.ts";

// Same strokes, label slot, tick length and label offsets as axes() in svjeez/extras, so the two sit in one scene.
const TICK = 4;

const ACCENTS = ["blue", "number", "green", "magenta", "cyan", "yellow", "red"] as const;

/** Drops float noise (0.30000000000000004) and `-0`. */
const compact = (n: number): string => String(Number(n.toPrecision(12)) + 0);

const finitePair = (what: string, [a, b]: readonly [number, number]): void => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a)
    throw new Error(
      `chart() needs a finite ${what} domain with max at or above min, got [${a}, ${b}].`,
    );
};

const countOf = (what: string, count: number): number => {
  if (!Number.isInteger(count) || count < 1)
    throw new Error(`chart() needs a whole number of ${what} ticks, at least 1, got ${count}.`);

  return count;
};

const spread = (low: number, high: number): [number, number] =>
  low === high ? [low, low + 1] : [low, high];

export function chart<X extends XScale>(options: ChartOptions<X>): Chart<X["kind"]> {
  const { width, height, at = { x: 0, y: 0 }, x: xs, data = [], grid = false } = options;
  const { theme = defaultDark, fontSize = 12, font } = options;
  const ys = options.y ?? {};

  if (!(width > 0) || !(height > 0) || !Number.isFinite(width + height))
    throw new Error(`chart() needs a positive width and height, got ${width} and ${height}.`);

  if (!(fontSize > 0)) throw new Error(`chart() needs a positive fontSize, got ${fontSize}.`);

  data.forEach(([x, y], i) => {
    if (!Number.isFinite(y) || (xs.kind === "linear" && !Number.isFinite(x)))
      throw new Error(`chart() needs finite data, got [${x}, ${y}] at index ${i}.`);
  });

  const yTicks = countOf("y", ys.ticks ?? 5);
  let yDomain: [number, number];

  if (ys.domain) {
    finitePair("y", ys.domain);
    yDomain = [...ys.domain];
  } else {
    if (data.length === 0)
      throw new Error("chart() needs y.domain or data to fit the y scale, got neither.");

    const values = data.map(([, y]) => y);
    yDomain = spread(
      Math.min(...values, ...(ys.zero === false ? [] : [0])),
      Math.max(...values, ...(ys.zero === false ? [] : [0])),
    );
  }

  const yScale = scaleLinear()
    .domain(yDomain)
    .nice(yTicks)
    .range([at.y + height, at.y]);

  const yFormat = ys.format ?? compact;
  const yTickValues = yScale.ticks(yTicks);
  const bottom = at.y + height;

  let xTickNodes: SvgNode[] = [];
  let xGridNodes: SvgNode[] = [];
  let bandwidth = 0;
  let xOf: (value: string | number) => number;
  let xDomain: readonly [number, number] | undefined;

  const stroke = tint(theme, "comment");
  const labelColor = tint(theme, "muted");

  const line = (x1: number, y1: number, x2: number, y2: number, strokeWidth = 1) =>
    el.line({ x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), stroke, strokeWidth });

  const text = (x: number, y: number, anchor: "middle" | "end", value: string) =>
    el.text(
      {
        x: round(x),
        y: round(y),
        fontSize,
        textAnchor: anchor,
        fill: labelColor,
        fontFamily: font,
      },
      value,
    );

  if (xs.kind === "band") {
    const seen = new Set<string>();

    for (const key of xs.domain) {
      if (seen.has(key))
        throw new Error(`chart() needs distinct x.domain categories, got "${key}" twice.`);
      seen.add(key);
    }

    if (xs.domain.length === 0)
      throw new Error("chart() needs at least one x.domain category, got none.");

    const padding = xs.padding ?? 0.3;

    if (!(padding >= 0 && padding < 1))
      throw new Error(`chart() needs x.padding from 0 up to 1, got ${padding}.`);

    const band = scaleBand<string>()
      .domain(xs.domain)
      .range([at.x, at.x + width])
      .paddingInner(padding)
      .paddingOuter(padding / 2);

    bandwidth = band.bandwidth();
    xOf = (key) => {
      const start = band(String(key));

      if (start === undefined)
        throw new Error(
          `x() got "${key}", which is not in the x domain (${xs.domain.join(", ")}). Add it to x.domain.`,
        );

      return start + bandwidth / 2;
    };

    const format = xs.format ?? String;

    xTickNodes = xs.domain.map((key) =>
      text(xOf(key), bottom + TICK + fontSize, "middle", format(key)),
    );
  } else {
    const xTicks = countOf("x", xs.ticks ?? 6);
    let domain: [number, number];

    if (xs.domain) {
      finitePair("x", xs.domain);
      domain = [...xs.domain];
    } else {
      if (data.length === 0)
        throw new Error("chart() needs x.domain or data to fit the x scale, got neither.");

      const values = data.map(([x]) => Number(x));
      domain = spread(Math.min(...values), Math.max(...values));
    }

    const scale = scaleLinear()
      .domain(domain)
      .nice(xTicks)
      .range([at.x, at.x + width]);

    const format = xs.format ?? compact;

    const [first, last] = scale.domain();

    xDomain = [first!, last!];
    xOf = (value) => scale(Number(value));

    const values = scale.ticks(xTicks);

    xTickNodes = [
      ...values.map((v) => line(xOf(v), bottom - TICK, xOf(v), bottom + TICK)),
      ...values.map((v) => text(xOf(v), bottom + TICK + fontSize, "middle", format(v))),
    ];

    xGridNodes = values.map((v) => line(xOf(v), at.y, xOf(v), bottom));
  }

  const [low, high] = yScale.domain();

  if (low === undefined || high === undefined)
    throw new Error("chart() could not fit the y scale.");

  const gridNodes = [
    ...yTickValues.map((v) => line(at.x, yScale(v), at.x + width, yScale(v))),
    ...xGridNodes,
  ];

  const node = el.g({}, [
    grid ? el.g({ strokeOpacity: 0.25 }, gridNodes) : undefined,
    low < 0 && high > 0 ? line(at.x, yScale(0), at.x + width, yScale(0)) : undefined,
    line(at.x, bottom, at.x + width, bottom, 1.5),
    line(at.x, at.y, at.x, bottom, 1.5),
    ...yTickValues.map((v) => line(at.x - TICK, yScale(v), at.x + TICK, yScale(v))),
    ...yTickValues.map((v) =>
      text(at.x - TICK - 3, yScale(v) + fontSize * 0.35, "end", yFormat(v)),
    ),
    ...xTickNodes,
  ]);

  let used = 0;

  const frame: Frame = {
    bounds: rect(at.x, at.y, width, height),
    theme,
    fontSize,
    font,
    bandwidth,
    yDomain: [low, high],
    xDomain,
    x: (value) => xOf(value),
    y: (value) => yScale(value),
    yFormat,
    nextColor: (): Color => tint(theme, ACCENTS[used++ % ACCENTS.length]!),
    categories: xs.kind === "band" ? xs.domain : undefined,
  };

  const series = buildSeries(frame);

  return {
    node,
    bounds: frame.bounds,
    x: (value) => xOf(value),
    y: (value) => yScale(value),
    bandwidth,
    // SAFETY: the conditional type on `bars` only offers it when the scale is a band, and series.bars throws otherwise.
    bars: series.bars as Chart<X["kind"]>["bars"],
    line: (points: readonly Datum<X["kind"]>[], o) => series.line(points, o),
    area: (points: readonly Datum<X["kind"]>[], o) => series.area(points, o),
  };
}
