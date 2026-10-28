import { def, motion, render, type Color } from "svjeez";
import { CSS } from "./kit";

// The app-icon mark: a small dot-matrix meter on a dark tile. It is the same trick as the signature, in seven columns.
const S = 208;
const COLS = 7;
const ROWS = 7;
const CELL = 20;
const D = 6;
const X0 = (S - COLS * CELL) / 2;
const Y0 = (S - ROWS * CELL) / 2;

const level = (c: number, t: number) => {
  const u = (2 * Math.PI * t) / D;
  return Math.max(1, Math.min(ROWS, Math.round(3.6 + 2.4 * Math.sin(c * 1.1 - u) * Math.cos(c * 0.5 + u * 0.5) + 0.8 * Math.sin(2 * u + c * 2))));
};
const dots = (fill: Color) => def.pattern({ width: CELL, height: CELL, patternUnits: "userSpaceOnUse" }, <circle cx={CELL / 2} cy={CELL / 2} r={6.2} fill={fill} />);
const off = dots("#3A3A3D");
const on = dots("#32D74B");
const tile = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#2E2E31" />
    <stop offset={1} stopColor="#141415" />
  </>
));

const bars = Array.from({ length: COLS }, (_, c) => {
  const first = level(c, 0);
  let m = motion({ height: first * CELL });
  let last = first;
  for (let t = 0.25; t < D - 0.25; t += 0.25) {
    const v = level(c, t);
    if (v !== last) m = m.at(t).set({ height: v * CELL });
    last = v;
  }
  return <rect x={c * CELL} width={CELL} height={first * CELL} fill={on} animation={last === first ? m : m.at(D - 0.25).set({ height: first * CELL })} />;
});

export default function build(): string {
  return render(
    { width: S, height: S, duration: D, title: "svjeez", desc: "The svjeez mark: a dot-matrix meter on a dark rounded tile, rising and falling.", css: CSS, reducedMotion: { at: 1 } },
    <>
      <rect width={S} height={S} rx={46} fill={tile} />
      <rect x={1} y={1} width={S - 2} height={S - 2} rx={45} fill="none" stroke="#fff" strokeOpacity={0.08} strokeWidth={2} />
      <g transform={`translate(${X0} ${Y0})`}>
        <rect width={COLS * CELL} height={ROWS * CELL} fill={off} />
        <g transform={`translate(0 ${ROWS * CELL}) scale(1 -1)`}>{bars}</g>
      </g>
    </>,
  );
}
