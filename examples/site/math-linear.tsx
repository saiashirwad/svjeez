import { tex } from "@svjeez/math";
import { css, def, ease, enter, motion, render, type Color } from "svjeez";
import { morph } from "svjeez/extras";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

// A linear transformation, 3Blue1Brown style: the grid, î and ĵ and the unit square move as one under A, and the square's area becomes det A.
const W = 504;
const H = 340;
const BAR = 40;
const D = 11;
const win = chrome(W, H, "linear.tsx");

/** Pixels per unit, and the origin of the plane. */
const U = 34;
const CX = 126;
const CY = 238;

const I = theme.base0B;
const J = theme.base08;
const AREA = theme.base0A;

/** One number drives the whole transformation: the grid is drawn through M(u) = I + u(A − I), with A = [[2, −1], [1, 1]]. */
const u = def.property("u", { syntax: "number", inherits: true, initial: 0 });
/** A shaft grows from the origin: `draw()` would leave a dash pattern that non-scaling-stroke reads in screen pixels. */
const g = def.property("g", { syntax: "number", inherits: false, initial: 0 });
const grow = (at: number) =>
  motion({ [g]: 0 })
    .at(at)
    .to({ [g]: 1 }, 0.5, ease.inOut);
const morphing = motion({ [u]: 0 })
  .at(3.6)
  .to({ [u]: 1 }, 2.6, ease.inOut);

const lines = (n: number) =>
  Array.from({ length: 2 * n + 1 }, (_, k) => k - n)
    .filter((k) => k !== 0)
    .map((k) => `M${k} ${-n}V${n}M${-n} ${k}H${n}`)
    .join("");

const scene = css`
  .plane path,.plane line,.plane polygon{vector-effect:non-scaling-stroke}
  .lin{transform:matrix(calc(1 + ${u}),${u},calc(0 - ${u}),1,0,0)}
  .hi{translate:calc((1 + ${u}) * ${U}px) calc(${u} * ${-U}px);rotate:atan2(calc(0 - ${u}),calc(1 + ${u}))}
  .hj{translate:calc(${u} * ${-U}px) ${-U}px;rotate:atan2(-1,calc(0 - ${u}))}
  .grow{scale:${g}}
  .mid{translate:0 calc(${u} * ${-U / 2}px)}
`;
const base = css(Object.assign([CSS], { raw: [CSS] }));

/** Arrowhead pointing along +x, its tip 4px past the end of the shaft so the shaft's square end hides inside it. */
const head = (fill: Color) => <polygon points="4,0 -8,-5.5 -8,5.5" fill={fill} />;

const label = (source: string, color: Color, x: number, y: number) =>
  tex(source, { x, y, fontSize: 17, color, anchor: [0.5, 0.5] });
const iHat = label(String.raw`\hat\imath`, I, 0, 0);
const jHat = label(String.raw`\hat\jmath`, J, 0, 0);

const at = { x: 404, y: 128, fontSize: 21, theme, anchor: [0.5, 0.5] } as const;
const matrix = tex(
  String.raw`A = \begin{bmatrix} \color{${I}}{2} & \color{${J}}{-1} \\ \color{${I}}{1} & \color{${J}}{1} \end{bmatrix}`,
  at,
);
const det = tex(String.raw`\det A = \color{${AREA}}{3}`, { ...at, y: 214 });

const area = (n: string) =>
  tex(n, { x: U / 2, y: -U / 2, fontSize: 15, color: AREA, anchor: [0.5, 0.5], display: false });
const areas = morph([area("1"), area("3")], { at: [7], over: 0.5 });

/** The tips of î and ĵ under M(u), in pixels from the origin: the labels ride along with CSS. */
const ride = css`
  .li{translate:calc((1 + ${u}) * ${U}px + 12px) calc(${u} * ${-U}px + 12px)}
  .lj{translate:calc(${u} * ${-U}px - 13px) ${-U + 2}px}
`;

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
      css: css`${base}${scene}${ride}`,
      reducedMotion: { at: D - 1.5 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g mask={body} animation={morphing}>
          <g class="plane" transform={`translate(${CX} ${CY}) scale(${U} ${-U})`}>
            <g animation={enter({ at: 0.2, over: 0.6 })}>
              <path d={lines(12)} fill="none" stroke={theme.base02} />
            </g>
            <g class="lin" animation={enter({ at: 0.5, over: 0.8 })}>
              <path d={lines(12)} fill="none" stroke={theme.base0D} strokeOpacity={0.55} />
              <path d="M-12 0H12M0 -12V12" fill="none" stroke={theme.base05} strokeWidth={1.5} />
            </g>
            <g class="lin">
              <g animation={enter({ at: 2.2, over: 0.6 })}>
                <polygon points="0,0 1,0 1,1 0,1" fill={AREA} fillOpacity={0.22} />
                <path d="M1 0V1H0" fill="none" stroke={AREA} strokeWidth={1.5} />
              </g>
              <line class="grow" x2={1} stroke={I} strokeWidth={3} animation={grow(1.3)} />
              <line class="grow" y2={1} stroke={J} strokeWidth={3} animation={grow(1.5)} />
            </g>
          </g>
          <g transform={`translate(${CX} ${CY})`}>
            <g class="mid" animation={enter({ at: 2.5, over: 0.5 })}>
              {areas.node}
            </g>
            <g class="hi" animation={enter({ at: 1.7, over: 0.2 })}>
              {head(I)}
            </g>
            <g class="hj" animation={enter({ at: 1.9, over: 0.2 })}>
              {head(J)}
            </g>
            <g class="li" animation={enter({ at: 1.8, over: 0.4 })}>
              {iHat.node}
            </g>
            <g class="lj" animation={enter({ at: 2.0, over: 0.4 })}>
              {jHat.node}
            </g>
          </g>
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
