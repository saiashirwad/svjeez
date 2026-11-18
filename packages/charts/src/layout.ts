import { scaleBand, scaleLinear } from "d3-scale";
import { SceneError } from "svjeez/tools";
import type { Datum, Plot, Series, XScale, YScale } from "./types.ts";

export const TICK = 4;

export interface Tick {
  readonly value: number;
  readonly at: number;
  readonly label: string;
}

export interface Layout {
  readonly plot: Plot;
  readonly width: number;
  readonly height: number;
  readonly yTicks: readonly Tick[];
  readonly xTicks: readonly Tick[];
  readonly bands: readonly { readonly key: string; readonly at: number }[];
  readonly yDomain: readonly [number, number];
  readonly zero: number;
  readonly yFormat: (value: number) => string;
}

const compact = (n: number): string => String(Number(n.toPrecision(12)) + 0);

const fail = (problem: string, fix: string): never => {
  throw new SceneError(problem, fix);
};

const finitePair = (what: string, [a, b]: readonly [number, number]): void => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a)
    fail(
      `${what}.domain is [${a}, ${b}].`,
      "Give two finite numbers, the smaller first: [min, max].",
    );
};

const tickCount = (what: string, count: number): number => {
  if (!Number.isInteger(count) || count < 1)
    fail(`${what}.ticks is ${count}.`, "Give a whole number of ticks, at least 1.");

  return count;
};

const spread = (low: number, high: number): [number, number] =>
  low === high ? [low, low + 1] : [low, high];

const within = (v: number, [low, high]: readonly [number, number]): boolean => {
  const slack = (high - low) * 1e-9;

  return v >= low - slack && v <= high + slack;
};

const labelOf = (series: Series): string =>
  series.options.name === series.kind
    ? `${series.kind}()`
    : `${series.kind}("${series.options.name}")`;

const checkSeries = (series: readonly Series[], x: XScale): void => {
  const names = new Set<string | undefined>();

  for (const s of series) {
    const label = labelOf(s);
    const { name, span } = s.options;

    if (names.has(name))
      fail(
        `Two series are both named "${name}".`,
        `Give each series of one chart its own name: ${s.kind}(data, { name: "…", color }).`,
      );
    names.add(name);

    if (span && (!(span.over > 0) || !Number.isFinite(span.start + span.over)))
      fail(
        `${label} has a span of ${span.start}s for ${span.over}s.`,
        "Give it span(start, over) with a positive over.",
      );

    if (s.kind === "bars" && x.kind !== "band")
      fail(
        `${label} needs categories on the x axis, and x is linear.`,
        'Use x: { kind: "band", domain: […] }, or draw a line() or area().',
      );

    if (s.kind !== "bars" && s.data.length < 2)
      fail(
        `${label} has ${s.data.length} point${s.data.length === 1 ? "" : "s"}.`,
        "A line or area needs at least 2 points.",
      );

    if (s.kind === "bars" && s.data.length === 0)
      fail(`${label} has no values.`, "Give it at least one bar.");

    if (s.kind === "bars") {
      const seen = new Set<string>();

      for (const [key] of s.data) {
        if (seen.has(key)) fail(`${label} has "${key}" twice.`, "Give each category one value.");
        seen.add(key);
      }
    }

    s.data.forEach(([px, py], i) => {
      if (!Number.isFinite(py))
        fail(
          `${label} has the value ${py} at index ${i}.`,
          "Clean NaN and Infinity out of the data first.",
        );

      if (x.kind === "band") {
        if (!x.domain.includes(String(px)))
          fail(
            `${labelOf(s)} has "${px}", which is not in x.domain (${x.domain.join(", ")}).`,
            "Add it to x.domain, or drop it from the data.",
          );
      } else if (!Number.isFinite(Number(px)))
        fail(
          `${labelOf(s)} has the x value ${JSON.stringify(px)} at index ${i}, and x is linear.`,
          'Use finite numbers, or x: { kind: "band", domain: […] } for categories.',
        );
    });
  }
};

export const layoutOf = (
  [width, height]: readonly [number, number],
  x: XScale,
  y: YScale,
  series: readonly Series[],
): Layout => {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width + height))
    fail(
      `size is [${width}, ${height}].`,
      "Give the plot area a positive width and height: size={[380, 260]}.",
    );

  checkSeries(series, x);

  const points: Datum[] = series.flatMap((s) => s.data);
  const wantsZero = y.zero ?? series.some((s) => s.kind !== "line");
  const yTickCount = tickCount("y", y.ticks ?? 5);
  let yFit: [number, number];

  if (y.domain) {
    finitePair("y", y.domain);
    yFit = [...y.domain];
  } else {
    const values = [
      ...points.map(([, v]) => v),
      ...series.flatMap((s) =>
        s.kind === "area" && s.options.baseline !== undefined ? [s.options.baseline] : [],
      ),
      ...(wantsZero ? [0] : []),
    ];

    if (values.length === 0)
      fail("There is nothing to fit the y axis to.", "Add a series, or give y.domain.");
    yFit = spread(Math.min(...values), Math.max(...values));
  }

  const yScale = scaleLinear().domain(yFit).nice(yTickCount).range([height, 0]);
  const [low = 0, high = 1] = yScale.domain();
  const yDomain: [number, number] = [low, high];

  if (y.domain)
    for (const s of series)
      for (const [px, py] of s.data)
        if (!within(py, yDomain))
          fail(
            `${labelOf(s)} has ${py} at ${px}, outside y.domain [${yDomain.join(", ")}].`,
            "Widen y.domain, or drop y.domain to fit the data.",
          );

  const yFormat = y.format ?? compact;
  const bottom = height;

  const yTicks = yScale
    .ticks(yTickCount)
    .map((value) => ({ value, at: yScale(value), label: yFormat(value) }));

  const clamp = (value: number): number => yScale(Math.min(Math.max(value, low), high));

  if (x.kind === "band") {
    const seen = new Set<string>();

    for (const key of x.domain) {
      if (seen.has(key)) fail(`x.domain has "${key}" twice.`, "Give each category once.");
      seen.add(key);
    }

    if (x.domain.length === 0) fail("x.domain is empty.", "Give at least one category.");
    const padding = x.padding ?? 0.3;

    if (!(padding >= 0 && padding < 1))
      fail(`x.padding is ${padding}.`, "Give a fraction from 0 up to 1.");

    const band = scaleBand<string>()
      .domain(x.domain)
      .range([0, width])
      .paddingInner(padding)
      .paddingOuter(padding / 2);

    const bandwidth = band.bandwidth();
    const format = x.format ?? String;

    const bands = x.domain.map((key) => ({ key, at: band(key)! }));

    return {
      width,
      height,
      yTicks,
      xTicks: bands.map(({ key, at }) => ({
        value: at,
        at: at + bandwidth / 2,
        label: format(key),
      })),
      bands,
      yDomain,
      zero: clamp(0),
      yFormat,
      plot: {
        size: [width, height],
        bandwidth,
        x: (value) => {
          const start = band(String(value));

          if (start === undefined)
            fail(
              `plot.x() got "${value}", which is not in x.domain (${x.domain.join(", ")}).`,
              "Ask for one of the categories.",
            );

          return start! + bandwidth / 2;
        },
        y: (value) => yScale(value),
      },
    };
  }

  const xTickCount = tickCount("x", x.ticks ?? 6);
  let xFit: [number, number];

  if (x.domain) {
    finitePair("x", x.domain);
    xFit = [...x.domain];
  } else {
    const values = points.map(([px]) => Number(px));

    if (values.length === 0)
      fail("There is nothing to fit the x axis to.", "Add a series, or give x.domain.");
    xFit = spread(Math.min(...values), Math.max(...values));
  }

  const xScale = scaleLinear().domain(xFit).nice(xTickCount).range([0, width]);
  const [first = 0, last = 1] = xScale.domain();

  if (x.domain)
    for (const s of series)
      for (const [px] of s.data)
        if (!within(Number(px), [first, last]))
          fail(
            `${labelOf(s)} has the x value ${px}, outside x.domain [${first}, ${last}].`,
            "Widen x.domain, or drop x.domain to fit the data.",
          );

  const xFormat = x.format ?? compact;

  return {
    width,
    height,
    yTicks,
    xTicks: xScale
      .ticks(xTickCount)
      .map((value) => ({ value, at: xScale(value), label: xFormat(value) })),
    bands: [],
    yDomain,
    zero: clamp(0),
    yFormat,
    plot: {
      size: [width, bottom],
      bandwidth: 0,
      x: (value) => xScale(Number(value)),
      y: (value) => yScale(value),
    },
  };
};
