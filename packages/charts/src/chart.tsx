/** @jsxImportSource svjeez */
import { area as d3area, curveLinear, curveMonotoneX, curveStep, line as d3line } from "d3-shape";
import {
  Group,
  Shape,
  Text,
  circle,
  draw,
  ease,
  enter,
  linear,
  path,
  pathData,
  rect,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { SceneError, type PathBuilder, type Spanned } from "svjeez/tools";
import { TICK, layoutOf, type Layout } from "./layout.ts";
import type { AreaOptions, BarsOptions, ChartProps, LineCurve, LineOptions } from "./types.ts";

const CURVES = { linear: curveLinear, monotone: curveMonotoneX, step: curveStep } as const;
const DOT_POP = 0.3;
const LABEL_IN = 0.4;

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
          stroke={{ color: chart.axis, width: 1 }}
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

interface SeriesTiming {
  readonly name: string;
  during(start: number, over: number): Spanned;
}

interface BarsProps {
  readonly look: Look;
  readonly data: readonly (readonly [string, number])[];
  readonly options: BarsOptions & SeriesTiming;
  readonly slot: { readonly index: number; readonly count: number };
}

const Bars = ({ look: { chart, layout, size }, data, options, slot }: BarsProps): SceneElement => {
  const { plot, zero } = layout;
  const { radius = 3, color, span: when, during } = options;
  const stagger = options.stagger ?? 0.08;
  const curve = options.ease ?? ease.out;

  if (!(stagger >= 0) || !Number.isFinite(stagger))
    throw new SceneError(
      `bars("${options.name}") has a stagger of ${stagger}.`,
      "Give 0 or more seconds.",
    );

  const gap = slot.count > 1 ? 2 : 0;
  const width = plot.bandwidth / slot.count;
  const barWidth = Math.max(1, width - gap);
  const r = Math.min(radius, barWidth / 2);
  const format = options.values === true ? layout.yFormat : options.values || undefined;
  const byKey = new Map(data);

  const drawn = layout.bands.flatMap(({ key, at }, i) => {
    const value = byKey.get(key);

    if (value === undefined) return [];
    const up = value >= 0;
    const length = Math.abs(zero - plot.y(value));
    const x = at + slot.index * width + gap / 2;
    const radii = up ? ([r, r, 0, 0] as const) : ([0, 0, r, r] as const);
    const start = when ? when.start + i * stagger : 0;

    const bar = (
      <Shape
        key={key}
        geometry={rect(barWidth, length, { radius: radii })}
        at={[x, zero]}
        anchor={up ? "bottom-left" : "top-left"}
        origin={up ? "bottom" : "top"}
        scale={when && track<Vec>([1, 0]).to([1, 1], during(start, when.over), curve)}
        fill={color}
      />
    );

    if (!format) return [bar];

    return [
      bar,
      <Text
        key={`${key}:value`}
        font={chart.font}
        size={size}
        at={[x + barWidth / 2, plot.y(value) + (up ? -4 : 4)]}
        anchor={up ? "bottom" : "top"}
        fill={chart.label}
        motion={
          when &&
          enter(during(start + when.over * 0.6, 0.35), {
            from: { opacity: 0, offset: [0, up ? 4 : -4] },
          })
        }
      >
        {format(value)}
      </Text>,
    ];
  });

  return <Group key={options.name}>{drawn}</Group>;
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
  readonly data: readonly (readonly [string | number, number])[];
  readonly options: LineOptions & SeriesTiming;
  readonly fill?: SceneElement;
  readonly stroked?: boolean;
}

const Line = ({
  look: { chart, layout, size },
  data,
  options,
  fill,
  stroked = true,
}: LineProps): SceneElement => {
  const { plot } = layout;
  const { color, span: when, label, during, width = 2.5 } = options;
  const points = data.map(([x, y]): Vec => [plot.x(x), plot.y(y)]);

  const d = d3line<Vec>()
    .x((p) => p[0])
    .y((p) => p[1])
    .curve(curveOf(options.curve))
    .digits(1)(points);

  const radius = options.dots === true ? 4 : options.dots || 0;
  const last = points.at(-1)!;
  const along = reaches(points);

  return (
    <Group key={options.name}>
      {fill}
      {stroked && (
        <Shape
          key="line"
          geometry={pathData(d!)}
          stroke={{ color, width, cap: "round", join: "round" }}
          trim={when && draw(during(when.start, when.over), { curve: ease.linear })}
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
            motion={
              when &&
              enter(during(when.start + when.over * along[i]!, DOT_POP), {
                from: { scale: 0 },
                curve: ease.pop,
              })
            }
          />
        ))}
      {label ? (
        <Text
          key="label"
          font={chart.font}
          size={size}
          at={[last[0] + (radius || width) + 8, last[1]]}
          anchor="left"
          fill={color}
          motion={
            when &&
            enter(during(when.start + when.over, LABEL_IN), {
              from: { opacity: 0, offset: [-8, 0] },
            })
          }
        >
          {label}
        </Text>
      ) : undefined}
    </Group>
  );
};

interface AreaProps {
  readonly look: Look;
  readonly data: readonly (readonly [string | number, number])[];
  readonly options: AreaOptions & SeriesTiming;
}

const Area = ({ look, data, options }: AreaProps): SceneElement => {
  const { plot, yDomain, width, height } = look.layout;
  const [low, high] = yDomain;
  const { color, span: when, during } = options;
  const baseline = options.baseline ?? 0;

  if (!Number.isFinite(baseline))
    throw new SceneError(
      `area("${options.name}") has a baseline of ${baseline}.`,
      "Give a finite y value.",
    );

  const base = plot.y(Math.min(Math.max(baseline, low), high));
  const points = data.map(([x, y]): Vec => [plot.x(x), plot.y(y)]);
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

  const fill = (
    <Shape
      key="fill"
      geometry={pathData(shape!)}
      fill={color}
      mask={fade}
      clip={
        when &&
        track(rect(0, height)).to(rect(width, height), during(when.start, when.over), ease.linear)
      }
    />
  );

  return (
    <Line look={look} data={data} options={options} fill={fill} stroked={options.line !== false} />
  );
};

export const Chart = (props: ChartProps): SceneElement => {
  const { size: area, x, y = {}, series, at = [0, 0], fontSize = 12 } = props;

  if (!(fontSize > 0)) throw new SceneError(`fontSize is ${fontSize}.`, "Give a positive size.");
  const layout = layoutOf(area, x, y, series);
  const look: Look = { chart: props, layout, size: fontSize };
  const count = series.filter((s) => s.kind === "bars").length;
  let placed = 0;

  const spans = new Map<string, Spanned>();

  const drawn = series.map((s) => {
    const name = s.options.name ?? s.kind;
    let first: number | undefined;
    let end = 0;

    const options = {
      ...s.options,
      name,
      during(start: number, over: number) {
        first = Math.min(first ?? start, start);
        end = Math.max(end, start + over);

        return span(start, over);
      },
    };

    let node: SceneElement;

    if (s.kind === "bars")
      node = <Bars look={look} data={s.data} options={options} slot={{ index: placed++, count }} />;
    else if (s.kind === "line") node = <Line look={look} data={s.data} options={options} />;
    else node = <Area look={look} data={s.data} options={options} />;

    spans.set(name, span(first ?? 0).until(end));

    return node;
  });

  return (
    <Group key={props.key} at={at}>
      <Axes look={look} />
      {drawn}
      {props.children?.({
        ...layout.plot,
        when(name) {
          const window = spans.get(name);

          if (!window) throw new SceneError(`plot.when() has no series named "${name}".`);

          return window;
        },
      })}
    </Group>
  );
};
