import { tex } from "@svjeez/math";
import { draw, enter, exit, render } from "svjeez";
import { axes, readout } from "svjeez/extras";
import { css, mono, theme } from "../style";

// Three ideas of calculus on three sets of axes: a secant collapsing into the tangent, Riemann sums refining
// into the area, and one curve bending through the Taylor polynomials of cos x.
const W = 960;
const H = 540;
const D = 15;

const PANEL = { width: 264, height: 250 };
const TOP = 132;
const left = (i: number) => 48 + i * 312;

const panel = (i: number, x: readonly [number, number], y: readonly [number, number]) =>
  axes({
    x,
    y,
    width: PANEL.width,
    height: PANEL.height,
    at: { x: left(i), y: TOP },
    theme,
    labels: false,
    ticks: { x: 1, y: 1 },
  });

const heading = (i: number, formula: string) =>
  tex(formula, { x: left(i) + PANEL.width / 2, y: 76, fontSize: 21, anchor: [0.5, 0.5], theme });

const fixed = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);

/** The derivative: the secant through x and x + h, with h shrinking to 0, then the tangent sliding along. */
const f = (x: number) => 2 + Math.sin(1.1 * x) + 0.15 * x;
const slopeGraph = panel(0, [-3, 3], [0, 4]);
const X = [{ from: -1, to: 2.2, at: 6.4, over: 2.2 }];
const H0 = { from: 2.2, to: 0, at: 2.4, over: 3 };
const secant = slopeGraph.secant(f, X, H0, { length: 150, color: theme.base08 });

/** The integral: rectangles that split in two each stage, then the exact area under them. */
const g = (x: number) => 0.4 + 0.3 * x * x;
const areaGraph = panel(1, [0, 3], [0, 3.2]);
const N = [2, 4, 8, 16, 32];
const SPLITS = [4.6, 5.6, 6.6, 7.6];

const sums = areaGraph.riemann(g, {
  from: 0.4,
  to: 2.8,
  n: N,
  at: SPLITS,
  over: 0.7,
  color: theme.base0A,
});

const exact = areaGraph.area(g, 0.4, 2.8, { color: theme.base0A, opacity: 0.45 });
const AREA_AT = 8.8;

/** Taylor polynomials of cos x around 0, as one curve that bends into each next one. */
const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));

const taylor = (n: number) => (x: number) => {
  let sum = 0;

  for (let k = 0; k <= n; k += 2) sum += ((-1) ** (k / 2) * x ** k) / factorial(k);

  return sum;
};

const waveGraph = panel(2, [-2 * Math.PI, 2 * Math.PI], [-1.8, 1.8]);
const DEGREES = [0, 2, 4, 6, 8, 10];
const BENDS = [8.6, 9.6, 10.6, 11.6, 12.6];

const cosine = waveGraph.plot(Math.cos, {
  color: theme.base0D,
  strokeWidth: 2,
  animation: draw({ at: 6.6, over: 1.2 }),
});

const poly = waveGraph.morph(DEGREES.map(taylor), {
  at: BENDS,
  over: 0.8,
  color: theme.base0E,
  strokeWidth: 2.5,
  animation: draw({ at: 7.6, over: 0.6 }),
});

const label = (i: number) => ({
  fontFamily: mono,
  fill: theme.base05,
  fontSize: 17,
  textAnchor: "middle" as const,
  x: left(i) + PANEL.width / 2,
  y: TOP + PANEL.height + 46,
});

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Calculus on axes",
      desc: "Three graphs. A secant through two points of a curve shrinks onto the tangent while its slope counts down to the derivative, then the tangent slides along the curve. Riemann rectangles under a parabola split from 2 to 32 while their sum approaches the area, which fills in. A curve bends through the Taylor polynomials of cos x, hugging the cosine further out with each degree.",
      css,
      reducedMotion: { at: D - 1 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {[
        heading(0, String.raw`f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}`),
        heading(
          1,
          String.raw`\int_a^b g\,dx = \lim_{n \to \infty} \sum_{i=1}^{n} g(x_i)\,\Delta x`,
        ),
        heading(2, String.raw`\cos x = \sum_{k} \frac{(-1)^k x^{2k}}{(2k)!}`),
      ].map((h, i) => (
        <g animation={enter({ at: 0.3 + i * 0.25, over: 0.6 })}>{h.node}</g>
      ))}
      {[slopeGraph, areaGraph, waveGraph].map((ax, i) => (
        <g animation={enter({ at: 0.2 + i * 0.25, over: 0.6 })}>{ax.node}</g>
      ))}

      {
        slopeGraph.plot(f, {
          color: theme.base0D,
          strokeWidth: 2,
          animation: draw({ at: 0.8, over: 1.2 }),
        }).node
      }
      <g animation={enter({ at: 1.8, over: 0.5 })}>{secant.node}</g>
      <g animation={enter({ at: 1.8, over: 0.5 })}>
        {readout(
          (t) =>
            t < H0.at + H0.over
              ? `slope ≈ ${fixed(secant.slope(t))}`
              : `f′(x) = ${fixed(secant.slope(t))}`,
          {
            ...label(0),
            at: 1.8,
            over: X[0]!.at + X[0]!.over - 1.8,
          },
        )}
      </g>

      {
        areaGraph.plot(g, {
          color: theme.base0D,
          strokeWidth: 2,
          animation: draw({ at: 2.6, over: 1 }),
        }).node
      }
      <g animation={[enter({ at: 3.6, over: 0.5 }), exit({ at: AREA_AT, over: 0.6 })]}>
        {sums.node}
      </g>
      <g animation={enter({ at: AREA_AT, over: 0.6 })}>{exact.node}</g>
      <g animation={enter({ at: 3.6, over: 0.5 })}>
        {readout(
          (t) => {
            const stage = SPLITS.filter((s) => s + 0.35 <= t).length;

            return t >= AREA_AT
              ? `area = ${exact.value(0).toFixed(3)}`
              : `n = ${N[stage]} · Σ = ${sums.sums[stage]!.toFixed(3)}`;
          },
          { ...label(1), at: 3.6, over: AREA_AT - 3.6 + 0.1 },
        )}
      </g>

      {cosine.node}
      {poly.node}
      <g animation={enter({ at: 7.6, over: 0.5 })}>
        {readout((t) => `degree ${DEGREES[BENDS.filter((b) => b + 0.4 <= t).length]}`, {
          ...label(2),
          at: 7.6,
          over: BENDS.at(-1)! - 7.6 + 0.5,
        })}
      </g>
      <g
        fontFamily={mono}
        fontSize={13}
        fill={theme.base03}
        animation={enter({ at: 1, over: 0.8 })}
      >
        {["graph.secant(f, x, h)", "graph.riemann(g, { n })", "graph.morph(taylors)"].map(
          (call, i) => (
            <text x={left(i) + PANEL.width / 2} y={H - 40} textAnchor="middle">
              {call}
            </text>
          ),
        )}
      </g>
    </>,
  );
}
