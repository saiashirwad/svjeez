/** @jsxImportSource svjeez */
import { area as d3area, curveLinear, curveMonotoneX, curveStep, line as d3line } from "d3-shape";
import {
  Group,
  Shape,
  Text,
  circle,
  enter,
  linear,
  path,
  rect,
  through,
  within,
  type Anim,
  type SceneElement,
  type Vec,
} from "svjeez";
import { SceneError, type PathBuilder, type StrokeProps } from "svjeez/tools";
import { TICK, layoutOf, type Layout } from "./layout.ts";
import type {
  AreaOptions,
  BarsOptions,
  ChartProps,
  Datum,
  LineCurve,
  LineOptions,
  Series,
} from "./types.ts";

const CURVES = { linear: curveLinear, monotone: curveMonotoneX, step: curveStep } as const;
const DOT_POP = 0.08;
const LABEL_IN = 0.15;

/** What a part of a series is while the whole is drawn to `draw`: nothing animates when there is no draw. */
const drawing =
  (draw: Anim<number> | undefined) =>
  <U,>(fn: (progress: number) => U): Anim<U> | undefined =>
    draw === undefined ? undefined : through(draw, fn);

/** A part's own progress, 0 to 1, while the series draws from `from` to `to`. */
const partOf = (
  draw: Anim<number> | undefined,
  from: number,
  to: number,
): Anim<number> | undefined => (draw === undefined ? undefined : within(draw, from, to));

const strokes = (...rows: readonly (readonly [Vec, Vec])[]): PathBuilder =>
  rows.reduce((p, [from, to]) => p.moveTo(from).lineTo(to), path());

const curveOf = (curve: LineCurve = "linear") => {
  if (!(curve in CURVES))
    throw new SceneError(`curve is "${curve}".`, 'Use "linear", "monotone" or "step".');

  return CURVES[curve];
};

interface Look {
  readonly chart: ChartProps;
  readonly layout: Layout;
  readonly size: number;
}

const Axes = ({ look: { chart, layout, size } }: { readonly look: Look }): SceneElement => {
  const { width, height, yTicks, xTicks } = layout;
  const bottom = height;
  const [low, high] = layout.yDomain;
  const band = chart.x.kind === "band";

  const guides = [
    ...yTicks.map(({ at }): readonly [Vec, Vec] => [
      [0, at],
      [width, at],
    ]),
    ...(band
      ? []
      : xTicks.map(({ at }): readonly [Vec, Vec] => [
          [at, 0],
          [at, bottom],
        ])),
  ];

  const marks = [
    ...yTicks.map(({ at }): readonly [Vec, Vec] => [
      [-TICK, at],
      [TICK, at],
    ]),
    ...(band
      ? []
      : xTicks.map(({ at }): readonly [Vec, Vec] => [
          [at, bottom - TICK],
          [at, bottom + TICK],
        ])),
    ...(low < 0 && high > 0
      ? [
          [
            [0, layout.zero],
            [width, layout.zero],
          ] as const,
        ]
      : []),
  ];

  return (
    <Group key="axes" motion={chart.axesIn && enter(chart.axesIn)}>
      {chart.grid && (
        <Shape
          key="grid"
          geometry={strokes(...guides)}
          stroke={{ color: chart.axis, width: 1, ...chart.grid }}
          opacity={0.25}
        />
      )}
      <Shape key="ticks" geometry={strokes(...marks)} stroke={{ color: chart.axis, width: 1 }} />
      <Shape
        key="axes"
        geometry={path().moveTo([0, 0]).lineTo([0, bottom]).lineTo([width, bottom])}
        stroke={{ color: chart.axis, width: 1.5 }}
      />
      {yTicks.map(({ value, at, label }) => (
        <Text
          key={`y:${value}`}
          font={chart.font}
          size={size}
          at={[-TICK - 3, at]}
          anchor="right"
          fill={chart.label}
        >
          {label}
        </Text>
      ))}
      {xTicks.map(({ value, at, label }) => (
        <Text
          key={`x:${value}`}
          font={chart.font}
          size={size}
          at={[at, bottom + TICK + 3]}
          anchor="top"
          fill={chart.label}
        >
          {label}
        </Text>
      ))}
    </Group>
  );
};

interface BarsProps {
  readonly look: Look;
  readonly data: readonly Datum<string>[];
  readonly options: BarsOptions;
  readonly slot: { readonly index: number; readonly count: number };
}

const Bars = ({ look: { chart, layout, size }, data, options, slot }: BarsProps): SceneElement => {
  const { plot, zero } = layout;
  const { radius = 3, color, draw } = options;
  const stagger = options.stagger ?? 0.3;

  if (!(stagger >= 0 && stagger < 1))
    throw new SceneError(
      `bars("${options.name}") has a stagger of ${stagger}.`,
      "Give a share of the draw from 0 up to, but not including, 1.",
    );

  const gap = slot.count > 1 ? 2 : 0;
  const width = plot.bandwidth / slot.count;
  const barWidth = Math.max(1, width - gap);
  const r = Math.min(radius, barWidth / 2);
  const format = options.values === true ? layout.yFormat : options.values || undefined;
  const byKey = new Map(data);

  const parts = layout.bands.flatMap(({ key, at }, i) => {
    const value = byKey.get(key);

    if (value === undefined) return [];
    const up = value >= 0;
    const length = Math.abs(zero - plot.y(value));
    const x = at + slot.index * width + gap / 2;
    const radii = up ? ([r, r, 0, 0] as const) : ([0, 0, r, r] as const);
    const start = layout.bands.length > 1 ? (stagger * i) / (layout.bands.length - 1) : 0;
    const grown = drawing(partOf(draw, start, start + 1 - stagger));

    const bar = (
      <Shape
        key={key}
        geometry={rect(barWidth, length, { radius: radii })}
        at={[x, zero]}
        anchor={up ? "bottom-left" : "top-left"}
        origin={up ? "bottom" : "top"}
        scale={grown((progress): Vec => [1, progress])}
        fill={color}
      />
    );

    if (!format) return [bar];

    const rest: Vec = [x + barWidth / 2, plot.y(value) + (up ? -4 : 4)];
    const lift = up ? 4 : -4;
    const shown = partOf(draw, start + 0.6 * (1 - stagger), start + 1 - stagger);

    return [
      bar,
      <Text
        key={`${key}:value`}
        font={chart.font}
        size={size}
        at={drawing(shown)((progress): Vec => [rest[0], rest[1] + (1 - progress) * lift]) ?? rest}
        anchor={up ? "bottom" : "top"}
        fill={chart.label}
        opacity={shown}
      >
        {format(value)}
      </Text>,
    ];
  });

  return <Group key={options.name}>{parts}</Group>;
};

const reaches = (points: readonly Vec[]): readonly number[] => {
  const sums = points.reduce<number[]>((acc, p, i) => {
    const prev = points[i - 1];

    acc.push((acc[i - 1] ?? 0) + (prev ? Math.hypot(p[0] - prev[0], p[1] - prev[1]) : 0));

    return acc;
  }, []);

  const total = sums.at(-1) || 1;

  return sums.map((length) => length / total);
};

interface LineProps {
  readonly look: Look;
  readonly points: readonly Vec[];
  readonly options: LineOptions;
  readonly fill?: SceneElement;
  readonly stroked?: boolean;
}

const Line = ({
  look: { chart, size },
  points,
  options,
  fill,
  stroked = true,
}: LineProps): SceneElement => {
  const { color, draw, label } = options;
  const stroke: StrokeProps = { color, width: 2.5, cap: "round", join: "round", ...options.stroke };
  // The label sits past the line end: a plain-number width moves it, a track or derived width keeps the default.
  // SAFETY: Number.isFinite is true only for a plain number.
  const width = Number.isFinite(stroke.width) ? (stroke.width as number) : 2.5;
  const drawn = drawing(draw);

  const d = d3line<Vec>()
    .x((p) => p[0])
    .y((p) => p[1])
    .curve(curveOf(options.curve))
    .digits(1)(points);

  const radius = options.dots === true ? 4 : options.dots || 0;
  const last = points.at(-1)!;
  const along = reaches(points);
  const rest: Vec = [last[0] + (radius || width) + 8, last[1]];
  const shown = partOf(draw, 1 - LABEL_IN, 1);

  return (
    <Group key={options.name}>
      {fill}
      {stroked && (
        <Shape
          key="line"
          geometry={path.parse(d!)}
          stroke={stroke}
          trim={drawn((progress): Vec => [0, progress])}
        />
      )}
      {radius > 0 &&
        points.map((at, i) => (
          <Shape
            key={`dot:${i}`}
            geometry={circle(radius)}
            at={at}
            anchor="center"
            fill={color}
            scale={partOf(draw, along[i]! * (1 - DOT_POP), along[i]! * (1 - DOT_POP) + DOT_POP)}
          />
        ))}
      {label ? (
        <Text
          key="label"
          font={chart.font}
          size={size}
          at={drawing(shown)((progress): Vec => [rest[0] - (1 - progress) * 8, rest[1]]) ?? rest}
          anchor="left"
          fill={color}
          opacity={shown}
        >
          {label}
        </Text>
      ) : undefined}
    </Group>
  );
};

interface AreaProps {
  readonly look: Look;
  readonly data: readonly Datum[];
  readonly options: AreaOptions;
}

const pointsOn = (plot: Layout["plot"], data: readonly Datum[]): Vec[] =>
  data.map(([x, y]) => [plot.x(x), plot.y(y)]);

const Area = ({ look, data, options }: AreaProps): SceneElement => {
  const { plot, yDomain, width, height } = look.layout;
  const [low, high] = yDomain;
  const { color, draw } = options;
  const baseline = options.baseline ?? 0;

  if (!Number.isFinite(baseline))
    throw new SceneError(
      `area("${options.name}") has a baseline of ${baseline}.`,
      "Give a finite y value.",
    );

  const base = plot.y(Math.min(Math.max(baseline, low), high));
  const points = pointsOn(plot, data);
  const top = Math.min(base, ...points.map(([, y]) => y));

  const shape = d3area<Vec>()
    .x((p) => p[0])
    .y0(base)
    .y1((p) => p[1])
    .curve(curveOf(options.curve))
    .digits(1)(points);

  const fade = (
    <Shape
      geometry={rect(width, height)}
      fill={linear({
        from: [0, top],
        to: [0, base],
        stops: [
          [0, "#00000066"],
          [1, "#00000000"],
        ],
      })}
    />
  );

  const fill = <Shape key="fill" geometry={path.parse(shape!)} fill={color} mask={fade} />;

  // Two nested clips wipe the fill open: the inner one slides in from the left while its content slides back.
  const wiped =
    draw === undefined ? (
      fill
    ) : (
      <Group key="fill" clip={rect(width, height)}>
        <Group
          clip={rect(width, height)}
          offset={through(draw, (progress): Vec => [-(1 - progress) * width, 0])}
        >
          <Group offset={through(draw, (progress): Vec => [(1 - progress) * width, 0])}>
            {fill}
          </Group>
        </Group>
      </Group>
    );

  return (
    <Line
      look={look}
      points={points}
      options={options}
      fill={wiped}
      stroked={options.line !== false}
    />
  );
};

export const Chart = (props: ChartProps): SceneElement => {
  const { size: area, x, y = {}, series, at = [0, 0], textSize = 12 } = props;

  if (!(textSize > 0)) throw new SceneError(`textSize is ${textSize}.`, "Give a positive size.");
  const layout = layoutOf(area, x, y, series);
  const look: Look = { chart: props, layout, size: textSize };
  const count = series.filter((s) => s.kind === "bars").length;
  let placed = 0;

  const drawn = series.map((s: Series) => {
    const options = { ...s.options, name: s.options.name };

    if (s.kind === "bars")
      return <Bars look={look} data={s.data} options={options} slot={{ index: placed++, count }} />;

    if (s.kind === "line")
      return <Line look={look} points={pointsOn(layout.plot, s.data)} options={options} />;

    return <Area look={look} data={s.data} options={options} />;
  });

  return (
    <Group key={props.key} offset={at}>
      <Axes look={look} />
      {drawn}
      {props.children?.(layout.plot)}
    </Group>
  );
};
