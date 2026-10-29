import { chart } from "@svjeez/charts";
import { enter, render } from "svjeez";
import { tint } from "svjeez/extras";
import { CSS, chrome, outro } from "./kit";
import { mono, theme } from "../style";

// An area wipes on from the left, then a marker shows where the curve turned.
const W = 504;
const H = 340;
const BAR = 40;
const D = 8;
const win = chrome(W, H, "area.tsx");

const hours = [26, 28, 25, 27, 29, 26, 24, 15, 11, 9, 8, 7];
const points = hours.map((h, i) => [i + 1, h] as const);

const c = chart({
  width: W - 132,
  height: H - BAR - 112,
  at: { x: 64, y: BAR + 28 },
  x: { kind: "linear", domain: [1, 12], ticks: 11 },
  y: { domain: [0, 30], ticks: 3, format: (h) => `${h}h` },
  theme,
  font: mono,
  fontSize: 10,
  grid: true,
});

const wait = c.area(points, {
  at: 0.8,
  over: 2.4,
  curve: "monotone",
  color: tint(theme, "number"),
  dots: 3,
  label: "median",
});

const ships = c.x(8);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Area chart",
      desc: "An orange area of median review hours wipes on from week 1 to week 12, its dots popping in as the line reaches them. A dashed line then marks week 8, where a review bot ships and the hours fall from about 26 to 7.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g animation={enter({ at: 0.2, over: 0.5 })}>{c.node}</g>
        {wait.node}
        <g animation={enter({ at: wait.end, over: 0.6 }, { opacity: 0, y: -6 })}>
          <line
            x1={ships}
            y1={c.y(30)}
            x2={ships}
            y2={c.y(0)}
            stroke={tint(theme, "comment")}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text
            x={ships + 8}
            y={c.y(30) + 12}
            fontFamily={mono}
            fontSize={11}
            fill={tint(theme, "plain")}
          >
            bot ships
          </text>
        </g>
        <g animation={enter({ at: wait.end + 0.4, over: 0.6 }, { opacity: 0, y: 6 })}>
          <text
            x={W / 2}
            y={H - 26}
            fontFamily={mono}
            fontSize={11}
            textAnchor="middle"
            fill={theme.base03}
          >
            {'c.area(points, { curve: "monotone" })'}
          </text>
        </g>
      </g>
    </>,
  );
}
