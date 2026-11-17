import { chart } from "@svjeez/charts";
import { enter, render, type Color, tint } from "svjeez";
import { rect } from "svjeez/geometry";

import { defaults, list, number, text, type Values } from "svjeez/params";

import { color, css, geist, hue, leave, mono, rise, theme, Title } from "../gallery-style";

const W = 960;
const H = 540;
const D = 11;

const SERIES = { maxLength: 8 };
const COUNT = { min: 0, max: 1_000_000 };

export const params = {
  title: text("Pull request review time", { maxLength: 60 }),
  headline: text("Median time to first review fell from 26 to 7 hours", { maxLength: 60 }),
  subtitle: text("Pull requests, January to June", { maxLength: 80 }),
  desc: text(
    "Two charts animate in. Grouped bars show pull requests opened and merged per month, merged catching up with opened. An area chart shows the median hours to a first review falling from about 26 to 7 after a review bot ships in week 8. Sample data.",
    { maxLength: 400, label: "What the charts show, for screen readers" },
  ),
  barsTitle: text("Opened and merged", { maxLength: 30 }),
  barsNote: text("Pull requests per month", { maxLength: 40 }),
  first: text("opened", { ...SERIES, label: "The first bar series' name" }),
  second: text("merged", { ...SERIES, label: "The second bar series' name" }),
  bars: list(
    { label: text("", { maxLength: 4 }), first: number(0, COUNT), second: number(0, COUNT) },
    [
      { label: "Jan", first: 42, second: 31 },
      { label: "Feb", first: 48, second: 38 },
      { label: "Mar", first: 51, second: 44 },
      { label: "Apr", first: 57, second: 55 },
      { label: "May", first: 63, second: 64 },
      { label: "Jun", first: 70, second: 72 },
    ],
    { min: 2, max: 8, label: "One group of two bars per label" },
  ),
  areaTitle: text("Time to first review", { maxLength: 30 }),
  areaNote: text("Median hours, by week", { maxLength: 40 }),
  areaLabel: text("median", { maxLength: 12 }),
  area: list(number(0, COUNT), [26, 28, 25, 27, 29, 26, 24, 15, 11, 9, 8, 7], {
    min: 3,
    max: 16,
    label: "One value per step, numbered from 1",
  }),
  mark: number(8, {
    min: 0,
    max: 16,
    step: 1,
    label: "The step to mark with a dashed line, or 0 for none",
  }),
  markLabel: text("Review bot ships", { maxLength: 24 }),
};

const pairs = <K extends string | number>(keys: readonly K[], values: readonly number[]) =>
  keys.map((key, i) => [key, values[i]!] as const);

const look = { theme, font: mono, fontSize: 12, grid: true } as const;

const plain = tint(theme, "plain");
const muted = tint(theme, "muted");

const [orange, blue, violet] = [hue.orange, hue.blue, hue.purple];

const heading = (x: number, title: string, note: string, at: number) => (
  <g animation={rise(at)}>
    <text x={x} y={140} fontFamily={geist} fontWeight={600} fontSize={18} fill={plain}>
      {title}
    </text>
    <text x={x} y={162} fontFamily={geist} fontSize={13} fill={muted}>
      {note}
    </text>
  </g>
);

const key = (x: number, color: Color, name: string, at: number) => (
  <g animation={enter({ at, over: 0.5 })}>
    <rect x={x} y={150} width={10} height={10} rx={3} fill={color} />
    <text x={x + 16} y={159} fontFamily={geist} fontSize={12} fill={muted}>
      {name}
    </text>
  </g>
);

export default function build(p: Values<typeof params> = defaults(params)): string {
  if (p.mark > p.area.length)
    throw new Error(
      `mark is step ${p.mark}, past the area's ${p.area.length} steps. Use 0 for no mark.`,
    );

  const months = p.bars.map((bar) => bar.label);
  const opened = p.bars.map((bar) => bar.first);
  const merged = p.bars.map((bar) => bar.second);
  const weeks = p.area.map((_, i) => i + 1);
  const top = Math.max(10, Math.ceil(Math.max(...p.area) / 10) * 10);

  const volume = chart({
    ...look,
    frame: rect(84, 196, 380, 290),
    x: { kind: "band", domain: months },
    y: { ticks: 4 },
    data: [...pairs(months, opened), ...pairs(months, merged)],
  });

  const turnaround = chart({
    ...look,
    frame: rect(568, 196, 300, 290),
    x: { kind: "linear", domain: [1, p.area.length], ticks: p.area.length - 1 },
    y: { domain: [0, top], ticks: 3 },
  });

  const open = volume.bars({ at: 0.6, over: 1.1 }, pairs(months, opened), {
    group: { index: 0, count: 2 },
    color: orange,
  });

  const done = volume.bars({ at: 0.8, over: 1.1 }, pairs(months, merged), {
    group: { index: 1, count: 2 },
    color: blue,
  });

  const wait = turnaround.area({ at: 1.2, over: 1.8 }, pairs(weeks, p.area), {
    curve: "monotone",
    color: violet,
    dots: 3.5,
    label: p.areaLabel,
  });

  const ships = turnaround.x(p.mark);

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: p.title,
      desc: p.desc,
      css,
      reducedMotion: { at: 6 },
    },
    <>
      <rect width="100%" height="100%" fill={color.bg} />
      <g animation={leave(D)}>
        <Title title={p.headline} subtitle={p.subtitle} />
        {heading(48, p.barsTitle, p.barsNote, 0.3)}
        {key(260, orange, p.first, 0.5)}
        {key(330, blue, p.second, 0.5)}
        {heading(532, p.areaTitle, p.areaNote, 0.8)}
        <g animation={enter({ at: 0.4, over: 0.6 })}>{volume.node}</g>
        {open}
        {done}
        <g animation={enter({ at: 0.9, over: 0.6 })}>{turnaround.node}</g>
        {wait}
        {p.mark > 0 && (
          <g animation={rise(2.8)}>
            <line
              x1={ships}
              y1={turnaround.y(top)}
              x2={ships}
              y2={turnaround.y(0)}
              stroke={tint(theme, "comment")}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text
              x={ships + 10}
              y={turnaround.y(top) + 14}
              fontFamily={geist}
              fontSize={13}
              fill={plain}
            >
              {p.markLabel}
            </text>
          </g>
        )}
      </g>
    </>,
  );
}
