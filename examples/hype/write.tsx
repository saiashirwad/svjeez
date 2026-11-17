import { fieldLines, streamlines } from "@svjeez/math";
import { Ink, ease, tool } from "svjeez";
import { motion } from "svjeez";
import { rect } from "svjeez/geometry";
import { jumps } from "../site/lib/blip";
import { C, Caption, Blip, H, Shot, W, hand } from "./kit";
import { MONTAGE } from "./montage";

const WRITTEN = "Write anything.";
const HAND_SIZE = 150;
const handX = (W - hand.measure(WRITTEN, HAND_SIZE)) / 2;
const SPEED = 1500;

const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;

  for (let i = 2; i + 1 < xy.length; i += 2)
    sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

  return sum;
};

const strokePaths = hand.path(WRITTEN, { size: HAND_SIZE, x: handX, y: 360 }).d.split(/(?=M)/);
const strokes: { d: string; at: number; over: number }[] = [];

for (const d of strokePaths) {
  const last = strokes.at(-1);
  const at = last ? last.at + last.over + 0.04 : 0.35;

  strokes.push({ d, at, over: lengthOf(d) / SPEED });
}

const inked = strokes.at(-1)!.at + strokes.at(-1)!.over;
export const HAND = { at: MONTAGE.at + MONTAGE.over, over: inked + 1.8 };
const cheer = jumps([{ land: inked + 1.35, height: 40 }]);
const nibTool = tool.nib({ size: 6, angle: 35, thin: 0.25 });

const { lines: wind } = streamlines(
  (x, y) => [1, 0.45 * Math.sin(x / 140 + y / 90) - 0.25 * Math.cos(y / 60)],
  { frame: rect(0, 40, W, H - 200), spacing: 44, minLength: 140, tolerance: 0.8 },
);

export const handwriting = (
  <Shot {...HAND} enter="fade" exit="rise">
    {fieldLines({ at: 0, over: 1.6 }, wind, { color: C.hairline, opacity: 1, strokeWidth: 1.2 })}
    {strokes.map(({ d, at, over }) => (
      <Ink d={d} tool={nibTool} fill={C.ink} draw={{ at, over }} ease={ease.linear} />
    ))}
    <Ink
      d={`M${handX + 40} 452C${W / 2 - 100} 436 ${W / 2 + 200} 436 ${W - handX - 30} 446`}
      tool={tool.brush({ size: 7, seed: 5 })}
      fill={C.accent}
      draw={{ at: inked + 0.1, over: 0.5 }}
    />
    <Blip
      x={W - handX - 6}
      y={440}
      size={0.42}
      pop={inked + 0.45}
      blinks={[inked + 1.1]}
      look={motion({ x: -6, y: -4 })}
      body={cheer.body}
      stretch={cheer.stretch}
      bulb={cheer.bulb}
    />
    <Caption
      at={0.2}
      tag="Ink · svjeez · @svjeez/math"
      call="<Ink tool={tool.nib()} /> + streamlines(wind)"
      line="single-line fonts inked stroke by stroke, over a vector field"
    />
  </Shot>
);
