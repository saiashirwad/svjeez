import { epicycles } from "@svjeez/math";
import { tex } from "@svjeez/math";
import { render } from "svjeez";
import { tint } from "svjeez/extras";
import { css, theme } from "../style";

const W = 960;
const H = 540;
const D = 14;

const pi = tex(String.raw`\pi`, { fontSize: 400, theme });

const drawing = epicycles(pi.words, {
  at: 0.8,
  over: 10,
  terms: 80,
  circles: 28,
  size: 360,
  center: [W / 2, H / 2],
  theme,
  fill: tint(theme, "blue"),
});

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Epicycles",
      desc: "Circles spinning on the tips of circles trace the letter pi, the largest first.",
      css,
      reducedMotion: { at: 12 },
    },
    drawing.node,
  );
}
