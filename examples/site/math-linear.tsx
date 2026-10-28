import { plane, tex } from "@svjeez/math";
import { css, def, enter, render } from "svjeez";
import { morph } from "svjeez/extras";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

// A linear transformation, 3Blue1Brown style: the grid, î and ĵ and the unit square move as one under A, and the square's area becomes det A.
const W = 504;
const H = 340;
const BAR = 40;
const D = 11;
const win = chrome(W, H, "linear.tsx");

const I = theme.base0B;
const J = theme.base08;
const AREA = theme.base0A;

const p = plane({ origin: { x: 126, y: 238 }, unit: 34, extent: 12, theme }).apply(
  [
    [2, -1],
    [1, 1],
  ],
  { at: 3.6, over: 2.6 },
);

const at = { x: 404, y: 128, fontSize: 21, theme, anchor: [0.5, 0.5] } as const;

const matrix = tex(
  String.raw`A = \begin{bmatrix} \color{${I}}{2} & \color{${J}}{-1} \\ \color{${I}}{1} & \color{${J}}{1} \end{bmatrix}`,
  at,
);

const det = tex(String.raw`\det A = \color{${AREA}}{3}`, { ...at, y: 214 });

const area = (n: string) =>
  tex(n, { fontSize: 15, color: AREA, anchor: [0.5, 0.5], display: false });

const areas = morph([area("1"), area("3")], { at: [7], over: 0.5 });

const base = css(Object.assign([CSS], { raw: [CSS] }));

const fade = def.linearGradient(
  { x1: 250, x2: 312, y1: 0, y2: 0, gradientUnits: "userSpaceOnUse" },
  <>
    <stop offset={0} stopColor="#fff" />
    <stop offset={1} stopColor="#fff" stopOpacity={0} />
  </>,
);

const body = def.mask(
  {},
  <path
    d={`M0.5 ${BAR}H${W - 0.5}V${H - 12.5}a12 12 0 0 1-12 12H12.5a12 12 0 0 1-12-12Z`}
    fill={fade}
  />,
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A linear transformation",
      desc: "A coordinate grid with the basis vectors î and ĵ and the unit square. The matrix A with columns (2, 1) and (−1, 1) is written out, then the whole grid moves so that î lands on (2, 1) and ĵ on (−1, 1), and the unit square stretches into a parallelogram whose area, 3, is det A.",
      css: css`${base}${p.css}`,
      reducedMotion: { at: D - 1.5 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g mask={body}>
          <g animation={enter({ at: 0.2, over: 0.6 })}>{p.background}</g>
          <g animation={enter({ at: 0.5, over: 0.8 })}>
            {p.grid}
            {p.axes}
          </g>
          <g animation={enter({ at: 2.2, over: 0.6 })}>
            {p.polygon([
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ])}
          </g>
          <g animation={enter({ at: 2.5, over: 0.5 })}>{p.label([0.5, 0.5], areas.node)}</g>
          {p.basis({ enter: { at: 1.3, over: 0.5 } })}
        </g>
        {matrix.write({ at: 2.2, over: 1.4 })}
        {det.write({ at: 7.0, over: 1.0 })}
        <g class="sans" animation={enter({ at: 2.6, over: 0.6 })}>
          <text x={404} y={H - 30} fontSize={12} fill={theme.base03} textAnchor="middle">
            {"matrix.write({ at: 2.2, over: 1.4 })"}
          </text>
        </g>
      </g>
    </>,
  );
}
