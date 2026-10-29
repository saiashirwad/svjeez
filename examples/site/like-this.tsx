import { Ink, ease, render, strokeFont, tool } from "svjeez";
import { css, theme } from "../style";

// A note beside the hero: "like this!" is hand-lettered and an arrow swoops down to the demo below. Then a second
// hand answers from the right, "and this", with an arrow back at the note, since the note is a svjeez scene too.
const W = 480;
const H = 190;
const casual = await strokeFont.load(new URL("../fonts/EMSCasualHand.svg", import.meta.url));
const allure = await strokeFont.load(new URL("../fonts/EMSAllure.svg", import.meta.url));

const GREEN = theme.base0B;
const ORANGE = theme.base09;

/** A felt-tip pen: an even line that thins a little where it lands and lifts. */
const marker = tool.pen({ size: 3.6, seed: 7 });

/** A finer ballpoint for the second voice, with a little waver. */
const ballpoint = tool.pencil({ size: 2.4, seed: 4 });

const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;

  for (let i = 2; i + 1 < xy.length; i += 2)
    sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

  return sum;
};

interface Stroke {
  readonly d: string;
  readonly at: number;
  readonly over: number;
}

/** Splits text into pen strokes, one after another from `start`, paced by length at `speed` px/s. */
const write = (d: string, start: number, speed: number): Stroke[] => {
  const strokes: Stroke[] = [];

  for (const piece of d.split(/(?=M)/)) {
    const last = strokes.at(-1);
    const at = last ? last.at + last.over + 0.03 : start;

    strokes.push({ d: piece, at, over: Math.max(0.08, lengthOf(piece) / speed) });
  }

  return strokes;
};

const endOf = (strokes: readonly Stroke[]) => strokes.at(-1)!.at + strokes.at(-1)!.over;

const like = write(casual.path("like this!", { size: 52, x: 128, y: 70 }).d, 0.4, 520);
const arrowAt = endOf(like) + 0.15;

/** A loose swoop from under the words down and to the left, and its two barbs. */
const SHAFT = "M150 90C112 100 74 112 62 144C56 158 56 168 58 178";
const HEAD = "M44 164L58 179L70 162";

const AND = { size: 40, y: 150 };
const andX = W - 14 - allure.measure("and this", AND.size);
const and = write(allure.path("and this", { ...AND, x: andX }).d, arrowAt + 1.1, 620);
const backAt = endOf(and) + 0.15;

/** A small hook from above "and this" up and back to the "!" of the note. */
const hookX = andX + 30;
const BACK = `M${hookX} 116C${hookX - 2} 94 ${hookX - 24} 78 330 74`;
const BACK_HEAD = "M342 64L329 74L343 84";

const END = backAt + 0.9;

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: END,
      loop: false,
      title: "Like this! And this.",
      desc: "The words like this! are handwritten and an arrow swoops down to the animated scene below. Then, in a different hand, and this is written to the right with an arrow pointing back at the note.",
      css,
      reducedMotion: { at: END },
    },
    <>
      {like.map((s) => (
        <Ink
          d={s.d}
          tool={marker}
          fill={GREEN}
          draw={{ at: s.at, over: s.over }}
          ease={ease.linear}
        />
      ))}
      <Ink d={SHAFT} tool={marker} fill={GREEN} draw={{ at: arrowAt, over: 0.5 }} ease={ease.out} />
      <Ink
        d={HEAD}
        tool={marker}
        fill={GREEN}
        draw={{ at: arrowAt + 0.45, over: 0.25 }}
        ease={ease.out}
      />
      {and.map((s) => (
        <Ink
          d={s.d}
          tool={ballpoint}
          fill={ORANGE}
          draw={{ at: s.at, over: s.over }}
          ease={ease.linear}
        />
      ))}
      <Ink
        d={BACK}
        tool={ballpoint}
        fill={ORANGE}
        draw={{ at: backAt, over: 0.4 }}
        ease={ease.out}
      />
      <Ink
        d={BACK_HEAD}
        tool={ballpoint}
        fill={ORANGE}
        draw={{ at: backAt + 0.38, over: 0.2 }}
        ease={ease.out}
      />
    </>,
  );
}
