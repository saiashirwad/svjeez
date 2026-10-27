import { render } from "svjeez";
import { adaptive, flow, tomorrow, tomorrowNight, type FlowOptions } from "svjeez/extras";
import { mono } from "../fonts/faces";

const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });
const W = 800;
const ROW = 90;
const D = 4;

const wave = (y: number) => Array.from({ length: 61 }, (_, i) => ({ x: 150 + i * 9.5, y: y + 22 * Math.sin((i / 60) * Math.PI * 2) }));

const rows: [string, Omit<FlowOptions, "at">][] = [
  ["dot", { style: "dot" }],
  ["comet", { style: "comet", arrive: true }],
  ["trace", { style: "trace", arrive: true }],
  ["packet", { style: "packet", label: "POST /login" }],
];

export default function build(): string {
  return render(
    {
      width: W,
      height: rows.length * ROW + 40,
      duration: D,
      title: "Flows",
      desc: "Four ways a token can run a path: a dot, a comet with a fading tail, a trace that lights the path, and a labelled packet.",
      reducedMotion: { at: 2 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {rows.map(([name, options], i) => {
        const points = wave(60 + i * ROW);
        return (
          <g fontFamily={mono}>
            <text x={40} y={64 + i * ROW} fontSize={13} fill={theme.base04}>
              {name}
            </text>
            <path d={points.map((p, k) => `${k ? "L" : "M"}${p.x} ${p.y}`).join("")} fill="none" stroke={theme.base02} strokeWidth={1.5} />
            {flow(points, { ...options, at: 0.4, over: 2.6, color: theme.base09 }).node}
          </g>
        );
      })}
    </>,
  );
}
