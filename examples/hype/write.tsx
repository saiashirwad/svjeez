import { Ink, ease, tool } from "svjeez";
import { fieldLines, shot, streamlines } from "svjeez/extras";
import { C, Caption, H, W, hand } from "./kit";
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

// Wind that curls around the word, drawn on behind it as the pen starts.
const { lines: wind } = streamlines(
  (x, y) => [1, 0.45 * Math.sin(x / 140 + y / 90) - 0.25 * Math.cos(y / 60)],
  { bounds: { x: 0, y: 40, w: W, h: H - 200 }, spacing: 44, minLength: 140, tolerance: 0.8 },
);

export const handwriting = (
  <g animation={shot(HAND, { enter: "fade", exit: "rise" })}>
    {fieldLines(wind, { at: HAND.at, over: 1.6, color: C.hairline, opacity: 1, strokeWidth: 1.2 })}
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
      tag="ink · svjeez/extras"
      call="<Ink tool={tool.nib()} /> + streamlines(wind)"
      line="single-line fonts inked stroke by stroke, over a vector field"
    />
  </g>
);
