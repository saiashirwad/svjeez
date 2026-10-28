import { render } from "svjeez";
import { sequence } from "svjeez/extras";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

const W = 504;
const H = 340;
const BAR = 40;
const win = chrome(W, H, "sequence.tsx");

const login = sequence(
  {
    actors: { you: "You", img: "<img>", cdn: { label: "CDN", role: "store" } },
    messages: [
      ["you", "img", "open README"],
      ["img", "cdn", "GET hello.svg"],
      ["cdn", "img", "1 file, 955 B", { reply: true }],
      { note: "img", text: "plays CSS keyframes" },
      ["img", "you", "animation", { reply: true }],
    ],
  },
  { theme, x: W / 2, y: BAR + (H - BAR) / 2, anchor: "center", fontSize: 12, class: "sans", play: { at: 0.6, step: 0.8 } },
);
const D = 8;

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A sequence diagram that plays",
      desc: "A browser image asks a CDN for one SVG file, gets it back and starts the animation. The messages appear one at a time.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>{login.node}</g>
    </>,
  );
}
