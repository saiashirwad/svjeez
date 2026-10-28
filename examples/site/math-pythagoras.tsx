import { tex } from "@svjeez/math";
import { draw, ease, enter, exit, motion, render, type Color } from "svjeez";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

// The rearrangement proof: four copies of one right triangle fill a square of side a + b twice over. One way they leave a tilted square c², the other way two squares a² and b², so a² + b² = c².
const W = 504;
const H = 340;
const BAR = 40;
const D = 12;
const win = chrome(W, H, "pythagoras.tsx");

const S = 210;
const A = 84;
const B = S - A;
const C = Math.hypot(A, B);
const X0 = 44;
const Y0 = BAR + (H - BAR - S) / 2;

const TRI = theme.base0D;
const AA = theme.base0B;
const BB = theme.base08;
const CC = theme.base0A;

type Point = readonly [number, number];

/** A triangle by its corners in square coordinates, and where its box center goes when the triangles rearrange. */
interface Triangle {
  readonly corners: readonly [Point, Point, Point];
  readonly to: Point;
  readonly at: number;
}

const center = (corners: readonly Point[]): Point => {
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);

  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

// The tilted square's corners sit a along each side, turning clockwise. The second arrangement puts a² top left and b² bottom right, and every triangle only slides.
const TOP_RIGHT: Point = [A + B / 2, A / 2];
const BOTTOM_LEFT: Point = [A / 2, A + B / 2];

const triangles: readonly Triangle[] = [
  {
    corners: [
      [0, S],
      [0, B],
      [B, S],
    ],
    to: TOP_RIGHT,
    at: 5.2,
  },
  {
    corners: [
      [0, 0],
      [A, 0],
      [0, B],
    ],
    to: BOTTOM_LEFT,
    at: 5.8,
  },
  {
    corners: [
      [S, S],
      [B, S],
      [S, A],
    ],
    to: BOTTOM_LEFT,
    at: 6.4,
  },
  {
    corners: [
      [S, 0],
      [S, A],
      [A, 0],
    ],
    to: TOP_RIGHT,
    at: 0,
  },
];

const label = (source: string, x: number, y: number, color: Color, fontSize = 20) =>
  tex(source, { x: X0 + x, y: Y0 + y, fontSize, color, anchor: [0.5, 0.5], display: false });

// Legs and hypotenuse of the top-left triangle, the hypotenuse's label pushed off its midpoint toward the square's center.
const legA = label("a", A / 2, -13, AA);
const legB = label("b", -13, B / 2, BB);
const hyp = label("c", A / 2 + (13 * B) / C, B / 2 + (13 * A) / C, CC);

const SIZE = 26;
const c2 = label("c^2", S / 2, S / 2, CC, SIZE);
const a2 = label("a^2", A / 2, A / 2, AA, SIZE);
const b2 = label("b^2", A + B / 2, A + B / 2, BB, SIZE);

const EX = (X0 + S + W) / 2 + 4;
const EY = Y0 + S / 2 - 6;
const at = { x: EX, y: EY, fontSize: SIZE, theme, anchor: [0.5, 0.5] } as const;

const equation = tex(
  String.raw`\cssId{a}{\color{${AA}}{a^2}} + \cssId{b}{\color{${BB}}{b^2}} = \cssId{c}{\color{${CC}}{c^2}}`,
  at,
);

const plusEquals = tex(String.raw`\phantom{a^2} + \phantom{b^2} = \phantom{c^2}`, {
  ...at,
  color: theme.base05,
});

/** A copy of an area label lifts off and settles into its place in the equation. */
const fly = (from: ReturnType<typeof label>, id: string, start: number) => {
  const to = equation.get(id);
  const dx = to.x + to.w / 2 - (from.bounds.x + from.bounds.w / 2);
  const dy = to.y + to.h / 2 - (from.bounds.y + from.bounds.h / 2);

  return (
    <g
      animation={motion({ opacity: 0, x: 0, y: 0 })
        .at(start)
        .set({ opacity: 1 })
        .to({ x: dx, y: dy }, 1.1, ease.inOut)}
    >
      {from.node}
    </g>
  );
};

const tilted = (
  [
    [A, 0],
    [S, A],
    [B, S],
    [0, B],
  ] as const satisfies readonly Point[]
)
  .map(([x, y]) => `${X0 + x},${Y0 + y}`)
  .join(" ");

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Pythagorean theorem",
      desc: "Four copies of a right triangle with legs a and b and hypotenuse c sit in a square of side a + b, leaving a tilted square of area c². The triangles slide into a second arrangement that leaves two squares, a² and b², and the area labels gather into a² + b² = c².",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <rect
          x={X0}
          y={Y0}
          width={S}
          height={S}
          fill="none"
          stroke={theme.base03}
          strokeWidth={1.5}
          animation={draw({ at: 0.3, over: 1 })}
        />
        <polygon
          points={tilted}
          fill={CC}
          fillOpacity={0.2}
          animation={motion({ opacity: 0 })
            .at(3.2)
            .to({ opacity: 1 }, 0.6)
            .at(5.1)
            .to({ opacity: 0 }, 0.5)}
        />
        <rect
          x={X0}
          y={Y0}
          width={A}
          height={A}
          fill={AA}
          fillOpacity={0.2}
          stroke={AA}
          strokeWidth={1.5}
          animation={enter({ at: 7.4, over: 0.6 })}
        />
        <rect
          x={X0 + A}
          y={Y0 + A}
          width={B}
          height={B}
          fill={BB}
          fillOpacity={0.2}
          stroke={BB}
          strokeWidth={1.5}
          animation={enter({ at: 7.6, over: 0.6 })}
        />
        {triangles.map((t, i) => {
          const [cx, cy] = center(t.corners);
          const points = t.corners.map(([x, y]) => `${x - cx},${y - cy}`).join(" ");

          return (
            <g transform={`translate(${X0 + cx} ${Y0 + cy})`}>
              <g
                animation={[
                  enter({ at: 1 + i * 0.25, over: 0.6 }, { opacity: 0, scale: 0.6 }, ease.pop),
                  t.at > 0 &&
                    motion({ x: 0, y: 0 })
                      .at(t.at)
                      .to({ x: t.to[0] - cx, y: t.to[1] - cy }, 1.3, ease.inOut),
                ]}
              >
                <polygon
                  points={points}
                  fill={TRI}
                  fillOpacity={0.28}
                  stroke={TRI}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              </g>
            </g>
          );
        })}
        <g animation={exit({ at: 4.8, over: 0.4 })}>
          {legA.write({ at: 2.2, over: 0.5 })}
          {legB.write({ at: 2.5, over: 0.5 })}
          {hyp.write({ at: 2.8, over: 0.5 })}
        </g>
        <g animation={exit({ at: 5.1, over: 0.5 })}>{c2.write({ at: 3.5, over: 0.7 })}</g>
        {a2.write({ at: 7.8, over: 0.6 })}
        {b2.write({ at: 8.0, over: 0.6 })}
        {fly(c2, "c", 4.1)}
        {fly(a2, "a", 8.7)}
        {fly(b2, "b", 8.9)}
        {plusEquals.write({ at: 9.9, over: 0.6 })}
        <g class="sans" animation={enter({ at: 1.8, over: 0.6 })}>
          <text x={EX} y={H - 30} fontSize={12} fill={theme.base03} textAnchor="middle">
            {"c2.write({ at: 3.5, over: 0.7 })"}
          </text>
        </g>
      </g>
    </>,
  );
}
