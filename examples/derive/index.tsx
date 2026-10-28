import { derive, readout, tex } from "@svjeez/math";
import { motion, render } from "svjeez";
import { tint } from "svjeez/extras";
import { css, theme } from "../style";

const W = 960;
const H = 540;
const D = 16;

const steps = [
  String.raw`2x^2 - 8x - 10 = 0`,
  { tex: String.raw`x^2 - 4x - 5 = 0`, note: String.raw`\div 2 \text{ both sides}` },
  { tex: String.raw`x^2 - 4x = 5`, note: String.raw`+ 5 \text{ both sides}` },
  { tex: String.raw`x^2 - 4x + 4 = 9`, note: String.raw`+ 4 \text{ both sides}` },
  { tex: String.raw`(x - 2)^2 = 9`, note: String.raw`\text{factor the left side}` },
  { tex: String.raw`x - 2 = \pm 3`, note: String.raw`\text{take the root}` },
  { tex: String.raw`x = 2 \pm 3`, note: String.raw`+ 2 \text{ both sides}` },
];

const proof = derive(steps, {
  at: 0.6,
  every: 2,
  over: 0.8,
  x: 330,
  y: 36,
  fontSize: 34,
  lineHeight: 58,
  stack: true,
  theme,
});

const label = tex(String.raw`\Delta = b^2 - 4ac =`, {
  x: 120,
  y: 468,
  fontSize: 30,
  color: tint(theme, "muted"),
  theme,
});

const count = (t: number) => {
  const u = Math.min(1, Math.max(0, (t - 1) / 2.4));

  return 144 * (1 - (1 - u) ** 3);
};

const value = readout(count, {
  x: label.bounds.x + label.width + 14,
  y: 468,
  fontSize: 30,
  duration: D,
  step: 0.05,
  color: tint(theme, "yellow"),
  theme,
});

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Completing the square",
      desc: "2x squared minus 8x minus 10 equals zero is solved line by line, each line stacked below the last with its equals sign in one column and a note on what was done. A counter beside it reads the discriminant up to 144.",
      css,
      reducedMotion: { at: 14 },
    },
    <>
      {proof.node}
      <g animation={motion({ opacity: 0 }).at(0.6).to({ opacity: 1 }, 0.6)}>
        {label.node}
        {value.node}
      </g>
    </>,
  );
}
