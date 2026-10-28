import { enter, render } from "svjeez";
import { Callout, Focus, code } from "svjeez/extras";
import { CSS, chrome, highlight, outro, theme } from "./kit";

const W = 504;
const H = 340;
const BAR = 40;
const win = chrome(W, H, "wave.tsx", { mono: true });

const shown = `<path d={wave}
  stroke="#0A6CFF"
  animation={draw({ at: 1, over: 2 })} />



<circle r={8} fill="#FF9F0A"
  animation={enter({ at: 3 })} />`;

const src = code(highlight(shown), { theme, fontSize: 15, lineHeight: 1.6, x: 32, y: BAR + 20 });
const [drawAt, enterAt] = [0.8, 4.4];
const one = { at: drawAt, over: 3.2 };
const two = { at: enterAt, over: 3.2 };
const D = Math.ceil(enterAt + 5);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Code explainers",
      desc: "Five lines of TSX type out. A spotlight moves across them and a note explains each: draw strokes the path on over two seconds, enter fades the dot in at three.",
      css: CSS,
      reducedMotion: { at: drawAt + 1.5 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <Focus stops={[{ during: one, target: src.lines(1, 3).pad(6) }, { during: two, target: src.lines(7, 8).pad(6) }]} dim={0.28}>
          <g class="mono" animation={enter({ at: 0.1, over: 0.5 }, { opacity: 0, y: 6 })}>{src.node}</g>
        </Focus>
        <g class="mono">
          <Callout theme={theme} color={theme.base0D} target={src.find("draw")} side="bottom" during={one} fontSize={14} columns={30}>draw() strokes the path on.</Callout>
          <Callout theme={theme} color={theme.base09} target={src.find("enter")} side="bottom" during={two} fontSize={14} columns={30}>enter() fades the dot in.</Callout>
        </g>
      </g>
    </>,
  );
}
