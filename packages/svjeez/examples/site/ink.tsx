import { Ink, draw, ease, enter, render, strokeFont, tool } from "svjeez";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

// Handwriting from a single-line font, then a brush swash under it.
const W = 504;
const H = 340;
const BAR = 40;
const D = 9;
const hand = await strokeFont.load(new URL("../fonts/EMSAllure.svg", import.meta.url));
const win = chrome(W, H, "ink.tsx");

const word = hand.path("hello", { size: 150, x: 44, y: BAR + 170 }).d.split(/(?=M)/);

const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;

  for (let i = 2; i + 1 < xy.length; i += 2)
    sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

  return sum;
};

const strokes: { d: string; at: number; over: number }[] = [];

for (const d of word) {
  const last = strokes.at(-1);
  const at = last ? last.at + last.over + 0.04 : 0.6;

  strokes.push({ d, at, over: Math.max(0.1, lengthOf(d) / 480) });
}

const swashAt = strokes.at(-1)!.at + strokes.at(-1)!.over + 0.3;

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Ink and handwriting",
      desc: "The word hello is handwritten stroke by stroke from a single-line font, then a brush swash is inked underneath it.",
      css: CSS,
      reducedMotion: { at: D - 2 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        {strokes.map((s) => (
          <path
            d={s.d}
            fill="none"
            stroke={theme.base06}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            animation={draw({ at: s.at, over: s.over }, ease.linear)}
          />
        ))}
        <Ink
          d={`M44 ${BAR + 218}C130 ${BAR + 240} 250 ${BAR + 196} 450 ${BAR + 226}`}
          tool={tool.brush({ size: 10, seed: 3 })}
          fill={theme.base09}
          draw={{ at: swashAt, over: 1.1 }}
        />
        <g class="sans" animation={enter({ at: swashAt + 1, over: 0.6 }, { opacity: 0, y: 6 })}>
          <text x={44} y={H - 28} fontSize={12} fill={theme.base03}>
            {"<Ink tool={tool.brush({ size: 10 })} draw={{ at: 4, over: 1 }} />"}
          </text>
        </g>
      </g>
    </>,
  );
}
