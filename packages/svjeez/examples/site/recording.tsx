import { render } from "svjeez";
import { terminal } from "svjeez/extras";
import { CSS, chrome, outro, termTheme } from "./kit";

const W = 504;
const H = 340;
const BAR = 40;
const win = chrome(W, H, "~/hello, zsh", { theme: termTheme, mono: true });

const session = terminal(
  [
    {
      cmd: "npx svjeez frames hello.tsx --times 0,1.5,3",
      output: [[["muted", "loop 4s, light"]], [["green", "frames/frame-00-0_000s.png"]], [["green", "frames/frame-01-1_500s.png"]], [["green", "frames/frame-02-3_000s.png"]]],
    },
    { cmd: "npx svjeez svg hello.tsx --out hello.svg" },
    { cmd: "npx svjeez skill --install", output: [[["muted", "installed the svjeez skill in .claude/skills/svjeez"]]] },
  ],
  { theme: termTheme, x: 24, y: BAR + 22, fontSize: 12.5, lineHeight: 1.75, cps: 90, gap: 0.35 },
);
const D = Math.ceil(session.end) + 3;

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Terminal recordings",
      desc: "Three svjeez commands typed into a terminal: frames, svg and skill, each with its output.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g class="mono" animation={outro(D)}>{session.node}</g>
    </>,
  );
}
