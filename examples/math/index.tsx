import { plane, tex } from "@svjeez/math";
import { motion, render, Brace, morph, span } from "svjeez";
import { rect } from "svjeez/geometry";
import { defaults, list, number, text, type Values } from "svjeez/params";
import { HEIGHT, MARGIN, WIDTH, css, hue, leave, mono, theme } from "../gallery-style";

const W = WIDTH;
const H = HEIGHT;
const D = 9;

const paint = (c: string, s: string) => String.raw`\textcolor{${c}}{${s}}`;
const [a, b] = [(s: string) => paint(hue.blue, s), (s: string) => paint(hue.purple, s)];

const RANGE = { min: -100, max: 100 };

export const params = {
  title: text("Expanding (a + b)²", { maxLength: 60 }),
  desc: text(
    "(a+b)^2 morphs into a^2+2ab+b^2 with a brace on the cross term, while a curve of (a+1)^2 draws beside it for b = 1.",
    { maxLength: 300, label: "What the scene shows, for screen readers" },
  ),
  before: text(String.raw`(${a("a")}+${b("b")})^2`, { maxLength: 300, label: "TeX shown first" }),
  after: text(
    String.raw`${a("a^2")} + \cssId{cross}{${paint(hue.orange, "2")}${a("a")}${b("b")}} + ${b("b^2")}`,
    {
      maxLength: 300,
      label:
        "TeX that the first morphs into. Wrap one term in \\cssId{cross}{...} to put the brace under it.",
    },
  ),
  brace: text("cross term", { maxLength: 30, label: "The label under the brace" }),
  curve: list(number(0, RANGE), [1, 2, 1], {
    min: 1,
    max: 6,
    label: "The plotted polynomial's coefficients from the constant up: [1, 2, 1] is 1 + 2x + x²",
  }),
  curveLabel: text(String.raw`b = 1:\ (a+1)^2`, { maxLength: 80, label: "TeX naming the curve" }),
  xMin: number(-4, RANGE),
  xMax: number(2, RANGE),
  yMin: number(0, RANGE),
  yMax: number(9, RANGE),
};

/** `coefficients` from the constant up, evaluated at `x`. */
const polynomial = (coefficients: readonly number[]) => (x: number) =>
  coefficients.reduceRight((sum, c) => sum * x + c, 0);

export default function build(p: Values<typeof params> = defaults(params)): string {
  if (p.xMin >= p.xMax || p.yMin >= p.yMax)
    throw new Error(
      `The plot needs xMin below xMax and yMin below yMax, got x ${p.xMin} to ${p.xMax} and y ${p.yMin} to ${p.yMax}.`,
    );

  const at = { x: MARGIN, y: 280, fontSize: 60, theme } as const;
  const square = tex(p.before, at);
  const expanded = tex(p.after, at);

  const graph = plane({
    xRange: [p.xMin, p.xMax],
    yRange: [p.yMin, p.yMax],
    frame: rect(W - MARGIN - 450, 84, 440, 340),
    ticks: { x: 1, y: 3 },
    grid: true,
    theme,
    font: mono,
    fontSize: 16,
  });

  const curve = graph.plot({ at: 0.6, over: 1.6 }, polynomial(p.curve), { color: hue.blue });

  const name = tex(p.curveLabel, {
    ...graph.point(p.xMin + 0.8, p.yMax - 0.8),
    fontSize: 24,
    color: hue.blue,
  });

  const m = morph([square, expanded], { at: [2.2], over: 1 });
  const cross = expanded.parts.find((part) => part.id === "cross");

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: p.title,
      desc: p.desc,
      css,
      reducedMotion: { at: 6 },
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />
      <g animation={leave(D)}>
        <g animation={motion({ opacity: 0 }).to({ opacity: 1 }, span(0.2, 0.5))}>{m.node}</g>
        {cross && (
          <Brace
            theme={theme}
            target={cross.box}
            side="below"
            label={p.brace}
            fontSize={18}
            show={{ at: 3.2, over: 2.5 }}
          />
        )}
        <g animation={motion({ opacity: 0 }).to({ opacity: 1 }, span(0.2, 0.5))}>
          {graph.node}
          {name}
        </g>
        {curve}
      </g>
    </>,
  );
}
