import { readFileSync } from "node:fs";
import {
  Group,
  Sequence,
  Shape,
  clock,
  ease,
  linear,
  moved,
  path,
  scene,
  span,
  track,
  type Paint,
  type Vec,
} from "svjeez";

// TypeGPU's logomark as their docs site serves it: the front fold and the back, each a path filled by its own gradient.
const source = readFileSync(new URL("../assets/typegpu.svg", import.meta.url), "utf8");

// The mark's own box in the file's 166 unit square: the scene is trimmed to it, so a page can line it up.
const LEFT = 26;
const TOP = 4;
const WIDTH = 117.5;
const HEIGHT = 151;

const shift = ([x, y]: Vec): Vec => [x - LEFT, y - TOP];

const number = (tag: string, name: string) =>
  Number(new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1]);

/** Each gradient in the file by id, its ends moved into the mark's box. */
const gradients = new Map(
  [...source.matchAll(/<linearGradient id="([^"]+)"([^>]*)>([\s\S]*?)<\/linearGradient>/g)].map(
    ([, id, tag, body]): [string, Paint] => [
      id!,
      linear({
        from: shift([number(tag!, "x1"), number(tag!, "y1")]),
        to: shift([number(tag!, "x2"), number(tag!, "y2")]),
        stops: [...body!.matchAll(/offset="([^"]+)" stop-color="#([0-9A-Fa-f]{6})"/g)].map(
          ([, offset, hex]): [number, `#${string}`] => [Number(offset), `#${hex}`],
        ),
      }),
    ],
  ),
);

const pieces = [...source.matchAll(/<path d="([^"]+)" fill="url\(#([^)]+)\)"/g)].map(
  ([, d, fill]) => ({ geometry: moved(path.parse(d!), [-LEFT, -TOP]), fill: gradients.get(fill!) }),
);

if (pieces.length !== 2 || pieces.some((piece) => !piece.fill))
  throw new Error(
    "assets/typegpu.svg should hold the logomark's two paths, each filled by a gradient it defines.",
  );

/** Hovering or focusing the TypeGPU link plays this clock: the mark rises a little and grows. */
const lift = clock("lift", span(0, 0.35));

export default scene(
  {
    size: [WIDTH, HEIGHT],
    duration: 1,
    title: "TypeGPU",
    desc: "TypeGPU's logomark, which rises a little when its link is hovered.",
    loop: false,
    still: 0,
    states: { idle: { lift: 0 }, hover: { lift: 1 } },
  },
  () => (
    <Sequence clock={lift}>
      <Group
        origin="center"
        scale={track(1).to(1.06, span(0, lift.over), ease.out)}
        motion={{ offset: track<Vec>([0, 0]).to([0, -6], span(0, lift.over), ease.out) }}
      >
        {pieces.map(({ geometry, fill }, index) => (
          <Shape key={String(index)} geometry={geometry} fill={fill!} />
        ))}
      </Group>
    </Sequence>
  ),
);
