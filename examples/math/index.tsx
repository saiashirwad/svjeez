import { plane, tex } from "@svjeez/math";
import { draw, motion, render, Brace, morph, tint } from "svjeez";
import { HEIGHT, MARGIN, WIDTH, css, leave, mono, theme } from "../gallery-style";

const W = WIDTH;
const H = HEIGHT;
const D = 9;

const at = { x: MARGIN, y: 250, fontSize: 52, theme } as const;

/** The square, then its expansion with the cross term named. */
const square = tex(String.raw`(a+b)^2`, at);
const expanded = tex(String.raw`a^2 + \cssId{cross}{2ab} + b^2`, at);

/** The square as a curve, with b fixed at 1. */
const graph = plane({
  x: [-4, 2],
  y: [0, 9],
  width: 320,
  height: 300,
  at: { x: W - MARGIN - 340, y: 110 },
  ticks: { x: 1, y: 3 },
  grid: true,
  theme,
  font: mono,
  fontSize: 14,
});

const curve = graph.plot((a) => (a + 1) ** 2, {
  color: tint(theme, "blue"),
  animation: draw({ at: 0.6, over: 1.6 }),
});

const name = tex(String.raw`b = 1:\ (a+1)^2`, {
  ...graph.point(-3.2, 8.2),
  fontSize: 20,
  color: tint(theme, "blue"),
});

const m = morph([square, expanded], { at: [2.2], over: 1 });

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Expanding (a + b)²",
      desc: "(a+b)^2 morphs into a^2+2ab+b^2 with a brace on the cross term, while a curve of (a+1)^2 draws beside it for b = 1.",
      css,
      reducedMotion: { at: 6 },
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />
      <g animation={leave(D)}>
        <g animation={motion({ opacity: 0 }).at(0.2).to({ opacity: 1 }, 0.5)}>{m.node}</g>
        <Brace
          theme={theme}
          target={expanded.get("cross")}
          side="below"
          label="cross term"
          fontSize={18}
          show={{ at: 3.2, over: 2.5 }}
        />
        <g animation={motion({ opacity: 0 }).at(0.2).to({ opacity: 1 }, 0.5)}>
          {graph.node}
          {name.node}
        </g>
        {curve.node}
      </g>
    </>,
  );
}
