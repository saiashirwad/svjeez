import { chart } from "@svjeez/charts";
import { enter, render, span, type Color, type Drawn } from "svjeez";
import { rect, type Rect } from "svjeez/geometry";
import { choice, defaults, list, number, text, type Values } from "svjeez/params";

import {
  HEIGHT,
  MARGIN,
  WIDTH,
  Title,
  color,
  css,
  geist,
  leave,
  mono,
  rise,
  theme,
} from "../../../examples/gallery-style";
import { block, charsIn, fitSize } from "../block";

const VALUE = { min: -1_000_000_000, max: 1_000_000_000 };

export const params = {
  title: text("Weekly signups doubled since March", {
    maxLength: 50,
    label:
      "The headline above the chart: what the data says, not just what it is. At most 50 characters.",
  }),
  subtitle: text("Signups and activations, last 8 weeks", {
    maxLength: 80,
    label:
      "One line under the title naming the measure, unit and period. Empty for none. At most 80 characters.",
  }),
  kind: choice("bar", ["bar", "line", "area"], {
    label: "bar for categories or counts per period, line for a trend, area for a total over time.",
  }),
  series: text("signups", {
    maxLength: 16,
    label:
      "The name of the first series, shown in the legend when there is a second. At most 16 characters.",
  }),
  compare: text("activated", {
    maxLength: 16,
    label:
      "The name of an optional second series drawn beside the first. Empty for a single series. At most 16 characters.",
  }),
  data: list(
    {
      label: text("", {
        maxLength: 20,
        label:
          "The category or period, such as Mar, Q3 24 or JavaScript. At most 20 characters, and shorter with many points: with 8 points about 13 characters fit under each, with 16 about 6.",
      }),
      value: number(0, { ...VALUE, label: "The first series' value." }),
      other: number(0, { ...VALUE, label: "The second series' value; 0 when there is none." }),
    },
    [
      { label: "W1", value: 2310, other: 1480 },
      { label: "W2", value: 2480, other: 1610 },
      { label: "W3", value: 2920, other: 1890 },
      { label: "W4", value: 3150, other: 2100 },
      { label: "W5", value: 3600, other: 2440 },
      { label: "W6", value: 3980, other: 2710 },
      { label: "W7", value: 4420, other: 3050 },
      { label: "W8", value: 4812, other: 3390 },
    ],
    { min: 2, max: 16, label: "The points from left to right, 2 to 16, each label used once." },
  ),
};

const D = 9;

/** The readable floor for the axis labels, and the room kept between neighbors. */
const SMALLEST = 11;
const LABEL_GAP = 8;

const Key = ({ x, y, fill, name }: { x: number; y: number; fill: Color; name: string }) => (
  <g>
    <rect x={x} y={y} width={10} height={10} rx={3} fill={fill} />
    <text x={x + 16} y={y + 9} fontFamily={geist} fontSize={13} fill={color.dim}>
      {name}
    </text>
  </g>
);

/** The chart's values: everything but the heading above it. */
export type ChartValues = Pick<Values<typeof params>, "kind" | "series" | "compare" | "data">;

/** The legend, when there is a second series, along the top of `box` and the chart below it, growing in. */
export const chartBlock = (p: ChartValues, box: Rect): Drawn => {
  const labels = p.data.map((point) => point.label);

  if (new Set(labels).size !== labels.length)
    throw new Error("data has a label more than once. Give every point its own label.");

  const first = p.data.map((point) => [point.label, point.value] as const);
  const second = p.compare ? p.data.map((point) => [point.label, point.other] as const) : [];
  const grow = span(0.9, 1.6);
  const [one, two] = color.series;

  const frame = rect(box.x + 72, box.y + 34, box.w - 88, box.h - 34);
  const room = frame.w / labels.length - LABEL_GAP;
  const fontSize = fitSize(mono, labels, 14, room, SMALLEST);

  if (fontSize === undefined) {
    const longest = labels.reduce((a, b) => (b.length > a.length ? b : a));

    throw new Error(
      `data labels must fit under their points: with ${labels.length} points about ${charsIn(mono, room, SMALLEST)} characters fit, and "${longest}" has ${longest.length}. Use shorter labels (abbreviate, such as Mar or JS) or fewer points.`,
    );
  }

  const plot = chart({
    theme,
    font: mono,
    fontSize,
    grid: true,
    frame,
    x: { kind: "band", domain: labels },
    y: { ticks: 4 },
    data: [...first, ...second],
  });

  const draw = (points: typeof first, fill: Color | undefined, index: number, at: number) => {
    const over = { at, over: grow.over };

    if (p.kind === "bar")
      return plot.bars(over, points, {
        color: fill,
        group: second.length ? { index, count: 2 } : undefined,
      });

    return p.kind === "line"
      ? plot.line(over, points, { color: fill, dots: 4 })
      : plot.area(over, points, { color: fill, dots: 4 });
  };

  return block(
    <>
      {second.length > 0 && (
        <g animation={rise(0.5)}>
          <Key x={box.x} y={box.y} fill={one!} name={p.series} />
          <Key x={box.x + 40 + p.series.length * 8} y={box.y} fill={two!} name={p.compare} />
        </g>
      )}
      <g animation={enter(span(0.6, 0.5))}>{plot.node}</g>
      {draw(first, one, 0, grow.at)}
      {second.length > 0 && draw(second, two, 1, grow.at + 0.2)}
    </>,
    span(0.5, grow.end + (second.length ? 0.2 : 0) - 0.5),
    box,
  );
};

export default function build(p: Values<typeof params> = defaults(params)): string {
  const drawn = chartBlock(p, rect(MARGIN, 136, WIDTH - 2 * MARGIN, 334));

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: p.title,
      desc: `${p.subtitle} A ${p.kind} chart: ${p.data.map((point) => `${point.label} ${point.value}${p.compare ? ` and ${point.other}` : ""}`).join(", ")}.`,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={color.bg} />
      <g animation={leave(D)}>
        <Title title={p.title} subtitle={p.subtitle || undefined} />
        {drawn.node}
      </g>
    </>,
  );
}
