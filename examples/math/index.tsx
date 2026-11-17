import { plane, tex } from "@svjeez/math";
import { motion, render, Brace, morph, span } from "svjeez";
import { rect } from "svjeez/geometry";
import { HEIGHT, MARGIN, WIDTH, css, hue, leave, mono, theme } from "../gallery-style";

const W = WIDTH;
const H = HEIGHT;
const D = 9;

const at = { x: MARGIN, y: 280, fontSize: 60, theme } as const;

const paint = (c: string, s: string) => String.raw`\textcolor{${c}}{${s}}`;
const [a, b] = [(s: string) => paint(hue.blue, s), (s: string) => paint(hue.purple, s)];
const square = tex(String.raw`(${a("a")}+${b("b")})^2`, at);

const expanded = tex(
  String.raw`${a("a^2")} + \cssId{cross}{${paint(hue.orange, "2")}${a("a")}${b("b")}} + ${b("b^2")}`,
  at,
);

const graph = plane({
  xRange: [-4, 2],
  yRange: [0, 9],
  frame: rect(W - MARGIN - 450, 84, 440, 340),
  ticks: { x: 1, y: 3 },
  grid: true,
  theme,
  font: mono,
  fontSize: 16,
});

const curve = graph.plot({ at: 0.6, over: 1.6 }, (a) => (a + 1) ** 2, { color: hue.blue });

const name = tex(String.raw`b = 1:\ (a+1)^2`, {
  ...graph.point(-3.2, 8.2),
  fontSize: 24,
  color: hue.blue,
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
        <g animation={motion({ opacity: 0 }).to({ opacity: 1 }, span(0.2, 0.5))}>{m.node}</g>
        <Brace
          theme={theme}
          target={expanded.part("cross").box}
          side="below"
          label="cross term"
          fontSize={18}
          show={{ at: 3.2, over: 2.5 }}
        />
        <g animation={motion({ opacity: 0 }).to({ opacity: 1 }, span(0.2, 0.5))}>
          {graph.node}
          {name}
        </g>
        {curve}
      </g>
    </>,
  );
}
