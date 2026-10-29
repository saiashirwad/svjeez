import { chart } from "@svjeez/charts";
import { enter, render } from "svjeez";
import { CSS, chrome, outro } from "./kit";
import { mono, theme } from "../style";

// Bars grow month by month, then a line draws across their tops.
const W = 504;
const H = 340;
const BAR = 40;
const D = 8;
const win = chrome(W, H, "chart.tsx");

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const merged = { Jan: 31, Feb: 38, Mar: 44, Apr: 55, May: 64, Jun: 72 };
const opened = { Jan: 42, Feb: 48, Mar: 51, Apr: 57, May: 63, Jun: 70 };

const c = chart({
  width: W - 112,
  height: H - BAR - 112,
  at: { x: 64, y: BAR + 28 },
  x: { kind: "band", domain: months },
  y: { domain: [0, 80], ticks: 4 },
  theme,
  font: mono,
  fontSize: 10,
  grid: true,
});

const bars = c.bars(merged, { at: 0.6, stagger: 0.12, radius: 3 });

const trend = c.line(Object.entries(opened), {
  at: bars.end,
  over: 1.4,
  curve: "monotone",
  dots: 3,
  color: theme.base09,
});

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Chart",
      desc: "Six bars grow up from the baseline one month at a time, then an orange line draws across the chart and its dots pop in as the stroke reaches them.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g animation={enter({ at: 0.2, over: 0.5 })}>{c.node}</g>
        {bars.node}
        {trend.node}
        <g animation={enter({ at: 1.6, over: 0.6 }, { opacity: 0, y: 6 })}>
          <text
            x={W / 2}
            y={H - 26}
            fontFamily={mono}
            fontSize={11}
            textAnchor="middle"
            fill={theme.base03}
          >
            {"c.bars(merged, { at: 0.6 })"}
          </text>
        </g>
      </g>
    </>,
  );
}
