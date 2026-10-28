import { chart } from "@svjeez/charts";
import { ease, enter, motion, render, type Color } from "svjeez";
import { tint } from "svjeez/extras";
import { geist, geistMono } from "../fonts/faces";
import { css, theme } from "../style";

const W = 960;
const H = 540;
const D = 11;

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const opened = [42, 48, 51, 57, 63, 70];
const merged = [31, 38, 44, 55, 64, 72];
const hours = [26, 28, 25, 27, 29, 26, 24, 15, 11, 9, 8, 7];
const weeks = hours.map((_, i) => i + 1);

const pairs = <K extends string | number>(keys: readonly K[], values: readonly number[]) =>
  keys.map((key, i) => [key, values[i]!] as const);

const look = { theme, font: geistMono, fontSize: 12, grid: true } as const;

const plain = tint(theme, "plain");
const muted = tint(theme, "muted");
const blue = tint(theme, "blue");
const orange = tint(theme, "number");

/** Left: pull requests opened and merged, side by side in each month. */
const volume = chart({
  ...look,
  width: 380,
  height: 290,
  at: { x: 84, y: 196 },
  x: { kind: "band", domain: months },
  y: { ticks: 4 },
  data: [...pairs(months, opened), ...pairs(months, merged)],
});

/** Right: hours until the first review, by week. */
const turnaround = chart({
  ...look,
  width: 300,
  height: 290,
  at: { x: 568, y: 196 },
  x: { kind: "linear", domain: [1, 12], ticks: 11 },
  y: { domain: [0, 30], ticks: 3 },
});

const open = volume.bars(Object.fromEntries(pairs(months, opened)), {
  at: 1.1,
  group: { index: 0, count: 2 },
  color: muted,
});

const done = volume.bars(Object.fromEntries(pairs(months, merged)), {
  at: 1.35,
  group: { index: 1, count: 2 },
  color: blue,
});

const wait = turnaround.area(pairs(weeks, hours), {
  at: 2.2,
  over: 2.2,
  curve: "monotone",
  color: orange,
  dots: 3.5,
  label: "median",
});

const ships = turnaround.x(8);

const heading = (x: number, title: string, note: string, at: number) => (
  <g animation={enter({ at, over: 0.7 }, { opacity: 0, y: 8 })}>
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

const leave = motion({ opacity: 1 })
  .at(D - 0.8)
  .to({ opacity: 0 }, 0.6, ease.in);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Review turnaround",
      desc: "Two charts animate in. Grouped bars show pull requests opened and merged per month, merged catching up with opened. An area chart shows the median hours to a first review falling from about 26 to 7 after a review bot ships in week 8.",
      css,
      reducedMotion: { at: 6 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <g animation={leave}>
        <g animation={enter({ at: 0.1, over: 0.8 }, { opacity: 0, y: 10 })}>
          <text x={48} y={64} fontFamily={geist} fontWeight={600} fontSize={30} fill={plain}>
            The review queue stopped being the bottleneck
          </text>
          <text x={48} y={90} fontFamily={geist} fontSize={15} fill={muted}>
            One review bot, six months of pull requests.
          </text>
        </g>
        {heading(48, "Opened and merged", "Pull requests per month", 0.5)}
        {key(260, muted, "opened", 0.9)}
        {key(330, blue, "merged", 0.9)}
        {heading(532, "Time to first review", "Median hours, by week", 1.5)}
        <g animation={enter({ at: 0.6, over: 0.8 })}>{volume.node}</g>
        {open.node}
        {done.node}
        <g animation={enter({ at: 1.6, over: 0.8 })}>{turnaround.node}</g>
        {wait.node}
        <g animation={enter({ at: 4.6, over: 0.6 }, { opacity: 0, y: -6 })}>
          <line
            x1={ships}
            y1={turnaround.y(30)}
            x2={ships}
            y2={turnaround.y(0)}
            stroke={tint(theme, "comment")}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text
            x={ships + 10}
            y={turnaround.y(30) + 14}
            fontFamily={geist}
            fontSize={13}
            fill={plain}
          >
            bot ships
          </text>
        </g>
      </g>
    </>,
  );
}
