import { Ink, ease, render, strokeFont, tool } from "svjeez";
import { css, theme } from "../style";

// A note beside the hero: "like this!" is hand-lettered, then an arrow swoops down to the demo below it.
const W = 340;
const H = 190;
const hand = await strokeFont.load(new URL("../fonts/EMSCasualHand.svg", import.meta.url));
const INK = theme.base0B;

/** A felt-tip pen: an even line that thins a little where it lands and lifts. */
const marker = tool.pen({ size: 3.6, seed: 7 });

const words = hand.path("like this!", { size: 52, x: 128, y: 70 }).d.split(/(?=M)/);

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
const SHAFT = "M150 90C112 100 74 112 62 144C56 158 56 168 58 178";
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
    <>
      {strokes.map((s) => (
        <Ink
          d={s.d}
          tool={marker}
          fill={INK}
          draw={{ at: s.at, over: s.over }}
          ease={ease.linear}
        />
      ))}
      <Ink d={SHAFT} tool={marker} fill={INK} draw={{ at: arrowAt, over: 0.5 }} ease={ease.out} />
      <Ink
        d={HEAD}
        tool={marker}
        fill={INK}
        draw={{ at: arrowAt + 0.45, over: 0.25 }}
        ease={ease.out}
      />
    </>,
  );
}
