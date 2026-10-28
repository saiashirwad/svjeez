import { def, motion, render, type Color } from "svjeez";
import { CSS, chrome, skeleton } from "./kit";
import { theme } from "../style";

// A README with an animated image in it: the meter plays right inside the page.
const W = 328;
const H = 264;
const D = 6;
const CELL = 12;
const COLS = 22;
const ROWS = 5;
const win = chrome(W, H, "README.md", { bar: 36 });

const level = (c: number, t: number) =>
  Math.max(
    1,
    Math.min(
      ROWS,
      Math.round(
        2.6 +
          1.9 *
            Math.sin(c * 0.5 - (2 * Math.PI * t) / D) *
            Math.sin(c * 0.17 + (2 * Math.PI * t) / D),
      ),
    ),
  );

const dots = (fill: Color) =>
  def.pattern(
    { width: CELL, height: CELL, patternUnits: "userSpaceOnUse" },
    <circle cx={CELL / 2} cy={CELL / 2} r={3.4} fill={fill} />,
  );

const off = dots(theme.base02);
const on = dots(theme.base0B);

const bars = Array.from({ length: COLS }, (_, c) => {
  const first = level(c, 0);
  let m = motion({ height: first * CELL });
  let last = first;

  for (let t = 0.25; t < D - 0.25; t += 0.25) {
    const v = level(c, t);

    if (v !== last) m = m.at(t).set({ height: v * CELL });
    last = v;
  }

  return (
    <rect
      x={c * CELL}
      width={CELL}
      height={first * CELL}
      fill={on}
      animation={last === first ? m : m.at(D - 0.25).set({ height: first * CELL })}
    />
  );
});

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "In a README",
      desc: "A README page with a heading, text and an animated dot-matrix image in the middle of it.",
      css: CSS,
      reducedMotion: { at: 2 },
    },
    <>
      {win.node}
      <rect x={24} y={58} width={96} height={13} rx={6.5} fill={theme.base06} />
      {skeleton(24, 90, [276, 250, 190])}
      <rect
        x={24}
        y={146}
        width={W - 48}
        height={86}
        rx={9}
        fill={theme.base01}
        stroke={theme.base02}
      />
      <g transform="translate(32 160)">
        <rect width={COLS * CELL} height={ROWS * CELL} fill={off} />
        <g transform={`translate(0 ${ROWS * CELL}) scale(1 -1)`}>{bars}</g>
      </g>
      {skeleton(24, 248, [220])}
    </>,
  );
}
