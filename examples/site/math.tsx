import { tex } from "@svjeez/math";
import { draw, ease, enter, motion, render, sampled, type Color } from "svjeez";
import { morph } from "svjeez/extras";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

// Euler's formula: a point turns once round the unit circle, then stops at π, and the formula follows it to e^{iπ} + 1 = 0.
const W = 504;
const H = 340;
const BAR = 40;
const D = 11;
const win = chrome(W, H, "euler.tsx");

const R = 78;
const CX = 128;
const CY = BAR + (H - BAR) / 2;

const COS = theme.base0D;
const SIN = theme.base0B;
const PI = theme.base09;

/** The angle at time t: one full turn, then half a turn more to 3π, which is π. */
const theta = (t: number): number => {
  const span = (from: number, over: number) => {
    const u = Math.min(1, Math.max(0, (t - from) / over));

    return u * u * (3 - 2 * u);
  };

  return 2 * Math.PI * span(1.6, 4) + Math.PI * span(6.2, 1.4);
};

const sample =
  <T extends Record<string, number>>(fn: (c: number, s: number) => T) =>
  (t: number) =>
    fn(R * Math.cos(theta(t)), -R * Math.sin(theta(t)));

const point = sampled(
  sample((x, y) => ({ x, y })),
  { duration: D, tolerance: { translate: 0.3 } },
);

const radius = sampled((t) => ({ rotate: (-theta(t) * 180) / Math.PI }), {
  duration: D,
  tolerance: { rotate: 0.4 },
});

const cosine = sampled(
  sample((x) => ({ x: Math.min(0, x), width: Math.abs(x) })),
  { duration: D, tolerance: { translate: 0.3, width: 0.3 } },
);

const sine = sampled(
  sample((x, y) => ({ x, y: Math.min(0, y), height: Math.abs(y) })),
  { duration: D, tolerance: { translate: 0.3, height: 0.3 } },
);

const at = { x: 238, y: CY - 22, fontSize: 25, theme } as const;

const angle = (a: string) =>
  tex(
    String.raw`e^{i\cssId{e}{${a}}} = \color{${COS}}{\cos\cssId{c}{${a}}} + \color{${SIN}}{i\sin\cssId{s}{${a}}}`,
    at,
  );

const versions = [
  angle(String.raw`\theta`),
  angle(String.raw`\color{${PI}}{\pi}`),
  tex(String.raw`e^{i\cssId{e}{\color{${PI}}{\pi}}} = -1`, at),
  tex(String.raw`e^{i\cssId{e}{\color{${PI}}{\pi}}} + 1 = 0`, at),
];

const m = morph(versions, { at: [5.9, 7.9, 9.0], over: 0.8 });

const label = (source: string, x: number, y: number, color: Color) =>
  tex(source, { x, y, fontSize: 15, color, display: false });

const one = label("1", CX + R + 6, CY + 4, theme.base03);
const minusOne = label("-1", CX - R - 28, CY + 6, PI);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Euler's formula",
      desc: "A point turns once round the unit circle while its cosine and sine trace the axes, then e^(iθ) = cos θ + i sin θ becomes e^(iπ) = −1 as the point stops at −1, and finally e^(iπ) + 1 = 0.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g animation={enter({ at: 0.3, over: 0.6 })}>
          <line x1={CX - R - 22} y1={CY} x2={CX + R + 22} y2={CY} stroke={theme.base02} />
          <line x1={CX} y1={CY - R - 22} x2={CX} y2={CY + R + 22} stroke={theme.base02} />
          {one.node}
        </g>
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={theme.base03}
          strokeWidth={1.5}
          animation={draw({ at: 0.4, over: 1.1 })}
        />
        <g transform={`translate(${CX} ${CY})`} animation={enter({ at: 1.3, over: 0.4 })}>
          <rect y={-1.25} height={2.5} rx={1.25} fill={COS} animation={cosine} />
          <rect x={-1} width={2} fill={SIN} animation={sine} />
          <line
            x1={-R}
            x2={R}
            stroke={theme.base05}
            strokeWidth={1.5}
            strokeDasharray={`0 ${R} ${R}`}
            animation={radius}
          />
          <g animation={point}>
            <circle
              r={6}
              fill="none"
              stroke={PI}
              strokeWidth={2}
              animation={motion({ opacity: 0, scale: 1 })
                .at(8.1)
                .to({ opacity: 0.9 }, 0.1)
                .to({ opacity: 0, scale: 3.4 }, 1, ease.out)}
            />
            <circle r={5.5} fill={theme.base07} />
          </g>
        </g>
        <g animation={enter({ at: 8.1, over: 0.5 }, { opacity: 0, x: 6 })}>{minusOne.node}</g>
        <g animation={enter({ at: 1, over: 0.7 }, { opacity: 0, y: 8 })}>{m.node}</g>
        <g class="sans" animation={enter({ at: 1.8, over: 0.6 })}>
          <text x={238} y={H - 30} fontSize={12} fill={theme.base03}>
            {"tex(String.raw`e^{i\\pi} + 1 = 0`)"}
          </text>
        </g>
      </g>
    </>,
  );
}
