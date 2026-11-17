import { tex } from "@svjeez/math";
import { render, span } from "svjeez";
import { defaults, list, text, type Values } from "svjeez/params";

import { HEIGHT, MARGIN, WIDTH, Title, css, leave, theme } from "../../../examples/gallery-style";

export const params = {
  title: text("Completing the square", {
    maxLength: 50,
    label: "The heading above the steps, naming what they show. At most 50 characters.",
  }),
  steps: list(
    text("", {
      maxLength: 160,
      label:
        "One line of the derivation in TeX math mode, without dollar signs, such as x^2 + 6x + 5 = 0.",
    }),
    [
      String.raw`x^2 + 6x + 5 = 0`,
      String.raw`x^2 + 6x + 9 = 4`,
      String.raw`(x + 3)^2 = 4`,
      String.raw`x + 3 = \pm 2`,
      String.raw`x = -1 \text{ or } x = -5`,
    ],
    {
      min: 1,
      max: 12,
      label: "The steps in order, 1 to 12. Each is written out under the one before.",
    },
  ),
};

const TOP = 136;
const BASE = 40;
const LARGEST = 48;
const SMALLEST = 30;
const GAP = 0.45;
const STEP = 1.2;

export default function build(p: Values<typeof params> = defaults(params)): string {
  const measured = p.steps.map((step) => tex(step, { fontSize: BASE }));
  const widest = Math.max(...measured.map((step) => step.width));
  const pitch = Math.max(...measured.map((step) => step.height)) * (1 + GAP);
  const room = { w: WIDTH - 2 * MARGIN, h: HEIGHT - MARGIN - TOP };

  const fontSize = Math.min(
    (BASE * room.w) / widest,
    Math.max(SMALLEST, Math.min(LARGEST, (BASE * room.h) / (pitch * measured.length))),
  );

  const row = (pitch * fontSize) / BASE;
  const height = Math.max(HEIGHT, Math.ceil(TOP + row * measured.length + MARGIN));

  const placed = p.steps.map((step, i) =>
    tex(step, { x: MARGIN, y: TOP + i * row, fontSize, theme }),
  );

  const D = 0.6 + placed.length * STEP + 3;

  return render(
    {
      width: WIDTH,
      height,
      duration: D,
      title: p.title,
      desc: `${p.title}, step by step: ${p.steps.join("; ")}.`,
      reducedMotion: { at: D - 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <g animation={leave(D)}>
        <Title title={p.title} />
        {placed.map((step, i) => step.write(span(0.6 + i * STEP, 1)).node)}
      </g>
    </>,
  );
}
