import { def, motion, render, type Color } from "svjeez";
import { CSS, theme } from "./kit";

// The signature: a dot-matrix meter. Every column is one bar filled with a dot pattern, so 48 columns cost 48 animated rects, not 336 dots.
const COLS = 48;
const ROWS = 7;
const CELL = 14;
const W = COLS * CELL;
const H = ROWS * CELL;
const D = 12;
const STEP = 0.25;

const level = (c: number, t: number) => {
  const u = (2 * Math.PI * t) / D;
  const wave = Math.sin(c * 0.33 - 2 * u) * 0.5 + Math.sin(c * 0.12 + u) * 0.9 + Math.sin(c * 0.71 - 3 * u) * 0.25;
  const swell = 0.5 + 0.5 * Math.sin(c * 0.09 - u);
  return Math.max(1, Math.min(ROWS, Math.round(2.6 + wave * 1.7 * swell + 1.2 * Math.sin(u * 2 + c * 0.05))));
};

const dots = (fill: Color) => def.pattern({ width: CELL, height: CELL, patternUnits: "userSpaceOnUse" }, <circle cx={CELL / 2} cy={CELL / 2} r={4.2} fill={fill} />);
const off = dots(theme.base02);
const on = dots(theme.base0B);

const bars = Array.from({ length: COLS }, (_, c) => {
  const first = level(c, 0);
  let m = motion({ height: first * CELL });
  let last = first;
  for (let t = STEP; t < D - STEP; t += STEP) {
    const v = level(c, t);
    if (v !== last) m = m.at(t).set({ height: v * CELL });
    last = v;
  }
  return <rect x={c * CELL} width={CELL} height={first * CELL} fill={on} animation={last === first ? m : m.at(D - STEP).set({ height: first * CELL })} />;
});

export default function build(): string {
  return render(
    { width: W, height: H, duration: D, title: "A dot-matrix meter", desc: "A row of dots rises and falls like a level meter. It is one SVG file made of rectangles filled with a dot pattern.", css: CSS, reducedMotion: { at: 3 } },
    <>
      <rect width={W} height={H} fill={off} />
      <g transform={`translate(0 ${H}) scale(1 -1)`}>{bars}</g>
    </>,
  );
}
