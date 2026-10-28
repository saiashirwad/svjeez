import { Ink, ease, tool } from "svjeez";
import { cut } from "svjeez/extras";
import { C, Caption, W, hand } from "./kit";
import { MONTAGE } from "./montage";

const HAND_AT = MONTAGE.at + MONTAGE.over;
const WRITTEN = "Write anything.";
const HAND_SIZE = 150;
const handX = (W - hand.measure(WRITTEN, HAND_SIZE)) / 2;
const SPEED = 1500;

/** Roughly how far the pen travels: along the control polygon, close enough to pace the writing. */
const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;

  for (let i = 2; i + 1 < xy.length; i += 2)
    sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

  return sum;
};

/** Each stroke of the pen in turn, at one speed, with a breath between lifts. */
const strokePaths = hand.path(WRITTEN, { size: HAND_SIZE, x: handX, y: 360 }).d.split(/(?=M)/);
const strokes: { d: string; at: number; over: number }[] = [];

for (const d of strokePaths) {
  const last = strokes.at(-1);
  const at = last ? last.at + last.over + 0.04 : HAND_AT + 0.35;

  strokes.push({ d, at, over: lengthOf(d) / SPEED });
}

const inked = strokes.at(-1)!.at + strokes.at(-1)!.over;
export const HAND = { at: HAND_AT, over: inked - HAND_AT + 1.8 };
const nibTool = tool.nib({ size: 6, angle: 35, thin: 0.25 });

export const handwriting = (
  <g animation={cut(HAND)}>
    {strokes.map(({ d, at, over }) => (
      <Ink d={d} tool={nibTool} fill={C.ink} draw={{ at, over }} ease={ease.linear} />
    ))}
    <Ink
      d={`M${handX + 40} 452C${W / 2 - 100} 436 ${W / 2 + 200} 436 ${W - handX - 30} 446`}
      tool={tool.brush({ size: 7, seed: 5 })}
      fill={C.accent}
      draw={{ at: inked + 0.1, over: 0.5 }}
    />
    <Caption
      at={HAND.at + 0.2}
      call="<Ink tool={tool.nib()} />"
      line="single-line fonts, inked stroke by stroke"
    />
  </g>
);
