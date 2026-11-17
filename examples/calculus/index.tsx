import { plane, tex } from "@svjeez/math";
import { draw, enter, exit, render, readout, span, stagger, type Span } from "svjeez";
import { rect } from "svjeez/geometry";
import { css, mono, theme } from "../style";

const W = 960;
const H = 540;
const D = 15;

const PANEL = { width: 264, height: 250 };
const TOP = 132;
const left = (i: number) => 48 + i * 312;

const panel = (i: number, x: readonly [number, number], y: readonly [number, number]) =>
  plane({
    xRange: x,
    yRange: y,
    frame: rect(left(i), TOP, PANEL.width, PANEL.height),
    theme,
    labels: false,
    ticks: { x: 1, y: 1 },
  });

const heading = (i: number, formula: string) =>
  tex(formula, { x: left(i) + PANEL.width / 2, y: 76, fontSize: 21, anchor: [0.5, 0.5], theme });

const fixed = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);

const f = (x: number) => 2 + Math.sin(1.1 * x) + 0.15 * x;
const slopeGraph = panel(0, [-3, 3], [0, 4]);
const SECANT = span(1.8, 0.5);

const SHRINK = span(2.4, 3);
const SLIDE = SHRINK.next(2.2, 1);

const secant = slopeGraph.secant(
  f,
  [{ ...SLIDE, from: -1, to: 2.2 }],
  { ...SHRINK, from: 2.2, to: 0 },
  { length: 150, color: theme.base08 },
);

const g = (x: number) => 0.4 + 0.3 * x * x;
const areaGraph = panel(1, [0, 3], [0, 3.2]);
const N = [2, 4, 8, 16, 32];
const SUMS = span(3.6, 0.5);
/** One split a second, from half a second after the sums arrive; the exact area half a second after the last. */

const SPLITS = stagger(SUMS.next(0.7, 0.5), N.length - 1, 1);
const AREA = SPLITS.at(-1)!.next(0.6, 0.5);

const sums = areaGraph.riemann(SPLITS, g, { from: 0.4, to: 2.8, n: N, color: theme.base0A });

const exact = areaGraph.area(g, 0.4, 2.8, { color: theme.base0A, opacity: 0.45 });

const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));

const taylor = (n: number) => (x: number) => {
  let sum = 0;

  for (let k = 0; k <= n; k += 2) sum += ((-1) ** (k / 2) * x ** k) / factorial(k);

  return sum;
};

const waveGraph = panel(2, [-2 * Math.PI, 2 * Math.PI], [-1.8, 1.8]);
const DEGREES = [0, 2, 4, 6, 8, 10];
const POLY = span(7.6, 0.6);
const BENDS = stagger(POLY.next(0.8, 0.4), DEGREES.length - 1, 1);

const past = (stages: readonly Span[], t: number) =>
  stages.filter((s) => s.at + s.over / 2 <= t).length;

const cosine = waveGraph.plot({ at: 6.6, over: 1.2 }, Math.cos, {
  color: theme.base0D,
  strokeWidth: 2,
});

const poly = waveGraph.morph(BENDS, DEGREES.map(taylor), {
  color: theme.base0E,
  strokeWidth: 2.5,
  animation: draw(POLY),
});

const HEADINGS = stagger(span(0.3, 0.6), 3, 0.25);
const PANELS = stagger(span(0.2, 0.6), 3, 0.25);

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
        <g animation={enter(HEADINGS[i]!)}>{h}</g>
      ))}
      {[slopeGraph, areaGraph, waveGraph].map((ax, i) => (
        <g animation={enter(PANELS[i]!)}>{ax.node}</g>
      ))}

      {slopeGraph.plot({ at: 0.8, over: 1.2 }, f, { color: theme.base0D, strokeWidth: 2 })}
      <g animation={enter(SECANT)}>{secant.node}</g>
      <g animation={enter(SECANT)}>
        {readout(
          SECANT.until(SLIDE.end),
          (t) =>
            t < SHRINK.end
              ? `slope ≈ ${fixed(secant.slope(t))}`
              : `f′(x) = ${fixed(secant.slope(t))}`,
          label(0),
        )}
      </g>

      {areaGraph.plot({ at: 2.6, over: 1 }, g, { color: theme.base0D, strokeWidth: 2 })}
      <g animation={[enter(SUMS), exit(AREA)]}>{sums.node}</g>
      <g animation={enter(AREA)}>{exact.node}</g>
      <g animation={enter(SUMS)}>
        {readout(
          SUMS.until(AREA.at + 0.1),
          (t) => {
            const stage = past(SPLITS, t);

            return t >= AREA.at
              ? `area = ${exact.value(0).toFixed(3)}`
              : `n = ${N[stage]} · Σ = ${sums.sums[stage]!.toFixed(3)}`;
          },
          label(1),
        )}
      </g>

      {cosine}
      {poly.node}
      <g animation={enter(POLY.first(0.5))}>
        {readout(
          POLY.until(BENDS.at(-1)!.at + 0.5),
          (t) => `degree ${DEGREES[past(BENDS, t)]}`,
          label(2),
        )}
      </g>
      <g
        fontFamily={mono}
        fontSize={13}
        fill={theme.base03}
        animation={enter({ at: 1, over: 0.8 })}
      >
        {[
          "graph.secant(f, x, h)",
          "graph.riemann(spans, g, { n })",
          "graph.morph(spans, taylors)",
        ].map((call, i) => (
          <text x={left(i) + PANEL.width / 2} y={H - 40} textAnchor="middle">
            {call}
          </text>
        ))}
      </g>
    </>,
  );
}
