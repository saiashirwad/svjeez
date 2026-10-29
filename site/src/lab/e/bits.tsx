import { ease, enter, exit, motion, type Child, type Stack } from "svjeez";
import { r1, type Cx } from "./look";
import { INK } from "./palette";

/** A group whose rotate and scale pivot on 0,0: an invisible square makes its box symmetric. */
export const Pivot = ({
  size,
  children,
  animation,
}: {
  size: number;
  children: Child;
  animation?: Stack<"rotate" | "scale">;
}) => (
  <g animation={animation}>
    <rect x={-size} y={-size} width={size * 2} height={size * 2} fill="none" />
    {children}
  </g>
);

/** When an eye closes for its two blinks of the loop. */
export type Blink = readonly [number, number];

export const blinkAt = (cx: Cx): Blink => {
  const a = 0.5 + cx.rand() * 3;

  return [a, a + 3.6 + cx.rand() * 0.6];
};

const blinkOpen = ([a, b]: Blink) =>
  motion({ opacity: 1 })
    .at(a)
    .set({ opacity: 0 })
    .at(a + 0.16)
    .set({ opacity: 1 })
    .at(b)
    .set({ opacity: 0 })
    .at(b + 0.16)
    .set({ opacity: 1 });

const blinkShut = ([a, b]: Blink) =>
  motion({ opacity: 0 })
    .at(a)
    .set({ opacity: 1 })
    .at(a + 0.16)
    .set({ opacity: 0 })
    .at(b)
    .set({ opacity: 1 })
    .at(b + 0.16)
    .set({ opacity: 0 });

export const Eye = ({
  cx,
  x,
  y,
  r,
  look,
  blink,
}: {
  cx: Cx;
  x: number;
  y: number;
  r: number;
  look?: Stack<"x">;
  blink: Blink;
}) => (
  <g transform={`translate(${r1(x)} ${r1(y)})`}>
    <g animation={blinkOpen(blink)}>
      <circle r={r1(r)} fill={cx.pal.eye} stroke={cx.ink} strokeWidth={1.6} />
      <g animation={look}>
        <ellipse rx={r1(r * 0.36)} ry={r1(r * 0.78)} fill={INK} />
        <circle cx={r1(-r * 0.12)} cy={r1(-r * 0.3)} r={r1(Math.max(1, r * 0.18))} fill="#fff" />
      </g>
    </g>
    <path
      d={`M${r1(-r)} 0Q0 ${r1(r * 0.7)} ${r1(r)} 0`}
      fill="none"
      stroke={cx.ink}
      strokeWidth={1.8}
      strokeLinecap="round"
      animation={blinkShut(blink)}
    />
  </g>
);

export const Speech = ({
  cx,
  text,
  size,
  delay,
}: {
  cx: Cx;
  text: string;
  size: number;
  delay: number;
}) => (
  <g
    animation={[
      enter({ at: delay, over: 0.3 }, { scale: 0, rotate: -25 }, ease.pop),
      exit({ at: delay + 1.15, over: 0.35 }, { opacity: 0, y: -10 }),
    ]}
  >
    <path
      d={`M-4 6l-7 7M2 8l1 9M-9 -1l-9 -2`}
      stroke={cx.ink}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <text
      x={6}
      y={0}
      fontSize={r1(size)}
      fontStyle="italic"
      fontWeight={700}
      fontFamily="ui-rounded, 'SF Pro Rounded', system-ui, sans-serif"
      fill={INK}
    >
      {text}
    </text>
  </g>
);
