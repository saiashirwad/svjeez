import { draw, ease, render, strokeFont } from "svjeez";
import { css, theme } from "../style";

// A note beside the hero: "like this!" is handwritten, then an arrow swoops down to the demo below it.
const W = 340;
const H = 190;
const hand = await strokeFont.load(new URL("../fonts/EMSAllure.svg", import.meta.url));
const INK = theme.base0B;

const words = hand.path("like this!", { size: 54, x: 118, y: 62 }).d.split(/(?=M)/);

const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;

  for (let i = 2; i + 1 < xy.length; i += 2)
    sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

  return sum;
};

const strokes: { d: string; at: number; over: number }[] = [];

for (const d of words) {
  const last = strokes.at(-1);
  const at = last ? last.at + last.over + 0.03 : 0.4;

  strokes.push({ d, at, over: Math.max(0.08, lengthOf(d) / 520) });
}

const arrowAt = strokes.at(-1)!.at + strokes.at(-1)!.over + 0.15;

/** A loose hand-drawn swoop from under the words down and to the left, and its two barbs. */
const SHAFT = "M150 84C112 96 74 112 62 144C56 158 56 168 58 178";
const HEAD = "M44 164L58 179L70 162";

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: arrowAt + 1.2,
      loop: false,
      title: "Like this!",
      desc: "The words like this! are handwritten, then an arrow swoops down to the animated scene below.",
      css,
      reducedMotion: { at: arrowAt + 1.2 },
    },
    <g fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
      {strokes.map((s) => (
        <path d={s.d} animation={draw({ at: s.at, over: s.over }, ease.linear)} />
      ))}
      <path d={SHAFT} animation={draw({ at: arrowAt, over: 0.5 }, ease.out)} />
      <path d={HEAD} animation={draw({ at: arrowAt + 0.45, over: 0.25 }, ease.out)} />
    </g>,
  );
}
