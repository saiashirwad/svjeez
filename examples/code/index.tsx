import { Code } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import { Group, Shape, ease, linear, rect, scene, span, track, type Vec } from "svjeez";
import { mono, theme } from "../theme";

const SIZE = 18;
const LINE = SIZE * 1.4;
const LEFT = 28;
const TOP = 21;

// The blocks the highlight visits, as [first line, last line], counting from 0.
const blocks: readonly (readonly [number, number])[] = [
  [1, 1],
  [2, 6],
  [4, 5],
  [7, 7],
];

const HOLD = 0.9;
const MOVE = 0.5;
const START = 2.4;

const top = ([first]: readonly [number, number]): Vec => [0, TOP + first * LINE];
const stretch = ([first, last]: readonly [number, number]): Vec => [1, last - first + 1];

// One bar slides to each block and stretches to cover it.
const walk = <T extends Vec>(of: (block: readonly [number, number]) => T) =>
  blocks
    .slice(1)
    .reduce(
      (path, block, i) =>
        path.to(of(block), span(START + (HOLD + MOVE) * i + HOLD, MOVE), ease.inOut),
      track<Vec>(of(blocks[0]!)),
    );

export default scene(
  {
    size: [480, 270],
    duration: START + (HOLD + MOVE) * (blocks.length - 1) + HOLD + 0.3,
    title: "A function, typed out",
    desc: "A binary search types itself in TypeScript, colored by role from the scene's palette, then a bar walks through its blocks: the setup, the loop, the branch, the return.",
    theme,
    loop: false,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={rect(canvas.width, LINE)}
        at={walk(top)}
        scale={walk(stretch)}
        origin="at"
        fill={linear({
          from: [0, 0],
          to: [canvas.width * 2, 0],
          stops: [theme.blue, theme.background],
        })}
        opacity={track(0).to(0.3, span(START - 0.4, 0.4))}
      />
      <Code
        lang="ts"
        font={mono}
        size={SIZE}
        lineHeight={1.4}
        palette={tomorrow}
        at={[LEFT, TOP]}
        typing={span(0.3, 1.8)}
      >
        {`function find(xs: number[], x: number) {
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}`}
      </Code>
    </Group>
  ),
);
