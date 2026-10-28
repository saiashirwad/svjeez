import { tex } from "@svjeez/math";
import { draw, motion, render } from "svjeez";
import { axes, Brace, morph, tint } from "svjeez/extras";
import { css, mono, theme } from "../style";

const W = 960;
const H = 540;

const at = { x: 56, y: 96, fontSize: 52, theme } as const;

/** The square, then its expansion with the cross term named, then the same expansion over its own root. */
const square = tex(String.raw`(a+b)^2`, at);
const expanded = tex(String.raw`a^2 + \cssId{cross}{2ab} + b^2`, at);
const reduced = tex(String.raw`\frac{a^2 + 2ab + b^2}{a+b} = a + b`, { ...at, y: 60 });

const theorem = tex(String.raw`(a+b)^n = \sum_{k=0}^{n} \binom{n}{k}\, a^{n-k} b^{k}`, {
  x: 56,
  y: 330,
  fontSize: 40,
  theme,
});

/** The square as a curve, with b fixed at 1. */
const graph = axes({
  x: [-4, 2],
  y: [0, 9],
  width: 280,
  height: 250,
  at: { x: 630, y: 70 },
  ticks: { x: 1, y: 3 },
  grid: true,
  theme,
  font: mono,
  fontSize: 14,
});

const curve = graph.plot((a) => (a + 1) ** 2, {
  color: tint(theme, "blue"),
  animation: draw({ at: 2.4, over: 1.6 }),
});

const name = tex(String.raw`(a+1)^2`, {
  ...graph.point(-2.6, 8.8),
  fontSize: 24,
  color: tint(theme, "blue"),
});

const m = morph([square, expanded, reduced], { at: [2, 6.6], over: 1 });

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: 12,
      title: "Equation transforms",
      desc: "(a+b)^2 morphs into a^2+2ab+b^2 with a brace on the cross term, divides by a+b, and generalizes to the binomial theorem.",
      css,
      reducedMotion: { at: 10 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <g animation={motion({ opacity: 0 }).at(0.2).to({ opacity: 1 }, 0.6)}>{m.node}</g>
      <Brace
        theme={theme}
        target={expanded.get("cross")}
        side="below"
        label="cross term"
        fontSize={18}
        during={{ at: 3.4, over: 2.8 }}
      />
      <g animation={motion({ opacity: 0 }).at(1.6).to({ opacity: 1 }, 0.6)}>
        {graph.node}
        {name.node}
      </g>
      {curve.node}
      <g animation={motion({ opacity: 0 }).at(8.8).to({ opacity: 1 }, 0.8)}>{theorem.node}</g>
    </>,
  );
}
