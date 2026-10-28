import { draw, enter, motion, render } from "svjeez";
import {
  axes,
  contours,
  contourSweep,
  fieldFlow,
  fieldLines,
  slopeField,
  slopeSolution,
  streamlines,
  tint,
  vectorField,
  type VectorField,
} from "svjeez/extras";
import { css, mono, theme } from "../style";

const W = 960;
const H = 540;

/** The flow: a clockwise and a counterclockwise vortex, a source feeding a sink, and a light wind from the left. */
const vortices = [
  { x: 190, y: 190, spin: 5200 },
  { x: 400, y: 330, spin: -6200 },
] as const;

const source = { x: 90, y: 400, rate: 2600 };
const sink = { x: 520, y: 150, rate: -2600 };

const wind: VectorField = (x, y) => {
  let [u, v] = [0.35, 0];

  for (const { x: cx, y: cy, spin } of vortices) {
    const [dx, dy] = [x - cx, y - cy];
    const r2 = dx * dx + dy * dy + 400;

    u += (-dy * spin) / r2 / 100;
    v += (dx * spin) / r2 / 100;
  }

  for (const { x: cx, y: cy, rate } of [source, sink]) {
    const [dx, dy] = [x - cx, y - cy];
    const r2 = dx * dx + dy * dy + 400;

    u += (dx * rate) / r2 / 100;
    v += (dy * rate) / r2 / 100;
  }

  return [u, v];
};

const bounds = { x: 24, y: 24, w: 600, h: 492 };

const lines = streamlines(wind, { bounds, spacing: 22, maxLength: 1400 });
const arrows = vectorField(wind, { bounds, spacing: 36, normalize: true });

const blue = tint(theme, "blue");
const orange = tint(theme, "number");
const green = tint(theme, "string");
const muted = tint(theme, "muted");

const heart = axes({
  x: [-1.6, 1.6],
  y: [-1.4, 1.5],
  width: 280,
  height: 250,
  at: { x: 660, y: 48 },
  ticks: { x: 1, y: 1 },
  theme,
  font: mono,
  fontSize: 11,
});

const implicit = (x: number, y: number) => (x * x + y * y - 1) ** 3 - x * x * y ** 3;

const sweep = contourSweep(implicit, {
  axes: heart,
  from: -0.97,
  to: 0,
  at: 5,
  over: 2.6,
  frames: 14,
});

const [rim] = contours(implicit, { axes: heart, levels: [0] });

const slopes = axes({
  x: [-3, 3],
  y: [-3, 3],
  width: 280,
  height: 200,
  at: { x: 660, y: 318 },
  ticks: { x: 1, y: 1 },
  theme,
  font: mono,
  fontSize: 11,
});

const slope = (x: number, y: number) => x - y;
const field = slopeField(slope, slopes, { step: 0.5, length: 12 });

const solutions = [
  { x: -3, y: 2.2 },
  { x: -3, y: -1 },
  { x: -3, y: -3 },
].map((start) => slopeSolution(slope, slopes, start));

const label = (x: number, y: number, text: string, at: number) => (
  <text
    x={x}
    y={y}
    fontSize={12}
    fontFamily={mono}
    fill={muted}
    animation={enter({ at, over: 0.6 }, { opacity: 0 })}
  >
    {text}
  </text>
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: 12,
      title: "Fields and level sets",
      desc: "A wind of vortices, a source and a sink: arrows, then evenly spaced streamlines drawing on and particles flowing along them. Beside it, a heart growing as the level set of an implicit function, and a slope field with three solution curves.",
      reducedMotion: { at: 9 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />

      <g
        stroke={muted}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.5}
        animation={motion({ opacity: 0 }).at(0.3).to({ opacity: 0.5 }, 1)}
      >
        <path d={arrows.d} />
      </g>

      {fieldLines(lines.lines, { at: 1.2, over: 3.2, color: blue, opacity: 0.5, theme })}
      {fieldFlow(lines.lines, { at: 3.5, color: orange, size: 3, speed: 110, theme })}
      {label(32, 512, "streamlines of a wind", 1.2)}

      <g>
        {heart.node}
        <path
          d={sweep.d}
          fill={blue}
          fillOpacity={0.18}
          stroke={blue}
          strokeWidth={2.5}
          strokeLinejoin="round"
          animation={[sweep.animation, motion({ opacity: 0 }).at(4.8).to({ opacity: 1 }, 0.4)]}
        />
        <path
          d={rim!.d}
          fill="none"
          stroke={orange}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          animation={motion({ opacity: 0 }).at(7.6).to({ opacity: 1 }, 0.6)}
        />
      </g>
      {label(660, 40, "(x² + y² − 1)³ − x²y³ = c, c rising to 0", 4.5)}

      <g>
        {slopes.node}
        <path
          d={field.d}
          fill="none"
          stroke={muted}
          strokeWidth={1.25}
          strokeLinecap="round"
          animation={motion({ opacity: 0 }).at(8).to({ opacity: 1 }, 0.8)}
        />
        {solutions.map(({ d }, i) => (
          <path
            d={d}
            fill="none"
            stroke={green}
            strokeWidth={2.2}
            strokeLinecap="round"
            animation={draw({ at: 8.6 + i * 0.5, over: 1.2 })}
          />
        ))}
      </g>
      {label(660, 308, "dy/dx = x − y", 8)}
    </>,
  );
}
