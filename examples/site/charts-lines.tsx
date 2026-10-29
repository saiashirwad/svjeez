import { chart } from "@svjeez/charts";
import { enter, render } from "svjeez";
import { tint } from "svjeez/extras";
import { CSS, chrome, outro } from "./kit";
import { mono, theme } from "../style";

// Three lines draw one after another, each in its own curve, and write their names at the end.
const W = 504;
const H = 340;
const BAR = 40;
const D = 9;
const win = chrome(W, H, "lines.tsx");

const releases = [1, 2, 3, 4, 5, 6, 7, 8];

const builds = {
  linux: [6.2, 5.8, 5.9, 5.1, 4.6, 4.4, 3.9, 3.6],
  macos: [8.4, 8.1, 7.2, 7.4, 6.5, 6.1, 5.8, 5.2],
  windows: [11.2, 11.2, 9.6, 9.6, 9.6, 8.1, 8.1, 7.4],
};

const c = chart({
  width: W - 160,
  height: H - BAR - 112,
  at: { x: 64, y: BAR + 28 },
  x: { kind: "linear", domain: [1, 8], ticks: 7, format: (v) => `v${v}` },
  y: { domain: [0, 12], ticks: 4, format: (m) => `${m}m` },
  theme,
  font: mono,
  fontSize: 10,
  grid: true,
});

const pairs = (values: readonly number[]) => releases.map((r, i) => [r, values[i]!] as const);

const linux = c.line(pairs(builds.linux), {
  at: 0.8,
  curve: "monotone",
  dots: 3,
  label: "linux",
  color: tint(theme, "green"),
});

const macos = c.line(pairs(builds.macos), {
  at: linux.end - 0.4,
  curve: "linear",
  dots: 3,
  label: "macos",
  color: tint(theme, "blue"),
});

const windows = c.line(pairs(builds.windows), {
  at: macos.end - 0.4,
  curve: "step",
  label: "windows",
  color: tint(theme, "number"),
});

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Line chart",
      desc: "Build minutes over eight releases. A green monotone line for linux draws first, then a blue straight-segment line for macos, then an orange step line for windows, and each writes its name past its last point. All three fall release by release.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g animation={enter({ at: 0.2, over: 0.5 })}>{c.node}</g>
        {linux.node}
        {macos.node}
        {windows.node}
        <g animation={enter({ at: windows.end, over: 0.6 }, { opacity: 0, y: 6 })}>
          <text
            x={W / 2}
            y={H - 26}
            fontFamily={mono}
            fontSize={11}
            textAnchor="middle"
            fill={theme.base03}
          >
            {'curve: "monotone" | "linear" | "step"'}
          </text>
        </g>
      </g>
    </>,
  );
}
