import { chart } from "@svjeez/charts";
import { enter, render, type Color } from "svjeez";
import { tint } from "svjeez/extras";
import { CSS, chrome, outro } from "./kit";
import { mono, theme } from "../style";

// Two series side by side in each month: opened grows first, merged catches up and writes its count.
const W = 504;
const H = 340;
const BAR = 40;
const D = 8;
const win = chrome(W, H, "grouped.tsx");

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const opened = { Jan: 42, Feb: 48, Mar: 51, Apr: 57, May: 63, Jun: 70 };
const merged = { Jan: 31, Feb: 38, Mar: 44, Apr: 55, May: 64, Jun: 72 };

const muted = tint(theme, "muted");
const blue = tint(theme, "blue");

const c = chart({
  width: W - 112,
  height: H - BAR - 120,
  at: { x: 64, y: BAR + 52 },
  x: { kind: "band", domain: months, padding: 0.25 },
  y: { domain: [0, 80], ticks: 4 },
  theme,
  font: mono,
  fontSize: 10,
  grid: true,
});

const open = c.bars(opened, { at: 0.6, stagger: 0.1, group: { index: 0, count: 2 }, color: tint(theme, "comment") });
const done = c.bars(merged, {
  at: open.end,
  stagger: 0.1,
  group: { index: 1, count: 2 },
  color: blue,
  values: true,
});

const key = (x: number, color: Color, name: string, at: number) => (
  <g animation={enter({ at, over: 0.5 })}>
    <rect x={x} y={BAR + 18} width={9} height={9} rx={2.5} fill={color} />
    <text x={x + 15} y={BAR + 26.5} fontFamily={mono} fontSize={11} fill={muted}>
      {name}
    </text>
  </g>
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Grouped bars",
      desc: "Gray bars for pull requests opened grow month by month, then blue bars for merged grow beside them, each writing its count, and by June merged has overtaken opened.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g animation={enter({ at: 0.2, over: 0.5 })}>{c.node}</g>
        {key(64, tint(theme, "comment"), "opened", 0.4)}
        {key(140, blue, "merged", open.end - 0.2)}
        {open.node}
        {done.node}
        <g animation={enter({ at: done.end, over: 0.6 }, { opacity: 0, y: 6 })}>
          <text x={W / 2} y={H - 22} fontFamily={mono} fontSize={11} textAnchor="middle" fill={theme.base03}>
            {"group: { index: 1, count: 2 }"}
          </text>
        </g>
      </g>
    </>,
  );
}
