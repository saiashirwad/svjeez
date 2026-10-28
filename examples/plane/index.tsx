import { plane, tex } from "@svjeez/math";
import { css as join, def, enter, render } from "svjeez";
import { css, theme } from "../style";

const W = 960;
const H = 540;
const D = 15;

/** Left: a matrix with two eigenvectors. Each one's span stays on itself while the rest of the grid turns. */
const M = [
  [3, 1],
  [0, 2],
] as const;

const linear = plane({ origin: { x: 200, y: 320 }, unit: 40, extent: 9, theme })
  .apply(M, { at: 2.4, over: 2.4 })
  .reset({ at: 6.4, over: 1.6 });

/** Right: w = e^z, which rolls vertical lines into circles and horizontal lines into rays. */
const exp = (x: number, y: number) =>
  [Math.exp(x) * Math.cos(y), Math.exp(x) * Math.sin(y)] as const;

const at = { x: 600, y: 300 };

const complex = plane({
  origin: at,
  unit: 88,
  extent: { x: [-1.25, 0.75], y: [-1.5, 1.5] },
  step: 0.25,
  theme,
}).applyFunction(exp, { at: 9, over: 3 });

const backdrop = plane({
  origin: at,
  unit: 88,
  extent: { x: [-1.25, 3.5], y: [-2.75, 2.75] },
  step: 0.25,
  theme,
});

const V1 = theme.base0A;
const V2 = theme.base0E;

const formula = (source: string, x: number, y: number) =>
  tex(source, { x, y, fontSize: 24, theme, anchor: [0.5, 0.5] });

const matrix = formula(String.raw`A = \begin{bmatrix} 3 & 1 \\ 0 & 2 \end{bmatrix}`, 110, 100);

const eigen = formula(
  String.raw`A\color{${V1}}{v_1} = 3\color{${V1}}{v_1}\quad A\color{${V2}}{v_2} = 2\color{${V2}}{v_2}`,
  240,
  500,
);

const map = formula(String.raw`w = e^{z}`, 870, 100);
const circle = formula(String.raw`e^{i\theta}`, 0, 0);

const left = def.clipPath({}, <rect x={0} y={0} width={W / 2 - 1} height={H} />);
const right = def.clipPath({}, <rect x={W / 2 + 1} y={0} width={W / 2} height={H} />);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Planes and transformations",
      desc: "Left: a grid with the eigenvectors of A = [[3, 1], [0, 2]] and their spans. A moves the grid, the eigenvectors stretch by 3 and 2 along their own lines, then the grid moves back. Right: a grid of the strip from −1.25 to 0.75 bends under w = e^z, vertical lines rolling into circles and horizontal ones into rays.",
      css: join`${join(Object.assign([css], { raw: [css] }))}${linear.css}`,
      reducedMotion: { at: 13.5 },
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />
      <line x1={W / 2} x2={W / 2} y1={24} y2={H - 24} stroke={theme.base02} />
      <g clipPath={left}>
        <g animation={enter({ at: 0.1, over: 0.6 })}>{linear.background}</g>
        <g animation={enter({ at: 0.3, over: 0.8 })}>
          {linear.grid}
          {linear.axes}
        </g>
        <g animation={enter({ at: 1.2, over: 0.6 })}>
          {linear.span([1, 0], { color: V1, opacity: 0.7 })}
          {linear.span([1, -1], { color: V2, opacity: 0.7 })}
        </g>
        {linear.vector([1, 0], { color: V1, label: "v_1", enter: { at: 1.5, over: 0.5 } })}
        {linear.vector([1, -1], { color: V2, label: "v_2", enter: { at: 1.7, over: 0.5 } })}
        {linear.vector([0, 1], {
          color: theme.base08,
          label: String.raw`\hat\jmath`,
          enter: { at: 1.9, over: 0.5 },
        })}
      </g>
      <g animation={enter({ at: 0.6, over: 0.6 })}>
        <rect
          x={20}
          y={64}
          width={180}
          height={72}
          rx={10}
          fill={theme.base00}
          fillOpacity={0.85}
        />
        {matrix.node}
      </g>
      <g animation={enter({ at: 3, over: 0.4 })}>
        <rect
          x={40}
          y={474}
          width={400}
          height={52}
          rx={10}
          fill={theme.base00}
          fillOpacity={0.85}
        />
      </g>
      {eigen.write({ at: 3.2, over: 1.6 })}
      <g clipPath={right}>
        <g animation={enter({ at: 7.4, over: 0.6 })}>{backdrop.background}</g>
        <g animation={enter({ at: 7.6, over: 0.8 })}>
          {complex.grid}
          {complex.axes}
        </g>
        {complex.vector([0, 1.5], { color: theme.base0A, enter: { at: 8.2, over: 0.5 } })}
        <g animation={enter({ at: 12.2, over: 0.6 })}>
          {complex.label([0.45, 1.5], circle, { color: theme.base0A })}
        </g>
      </g>
      {map.write({ at: 8, over: 1 })}
    </>,
  );
}
