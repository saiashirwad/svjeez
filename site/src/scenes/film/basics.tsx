import {
  Group,
  Shape,
  Text,
  circle,
  count,
  ease,
  enter,
  numeral,
  path,
  rect,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Builds, playsOf } from "./builds";
import { ACCENTS, RESULT_COLUMN, SHOTS, mono, spring, theme } from "./kit";

// The first code slide: a scene grows an element at a time, and each one plays in its own tile the moment its code
// lands. A circle pops in, a wave draws itself, a square springs across, a number counts up.

const ELEMENTS = [
  `    <Shape
      geometry={circle(30)} fill={blue}
      motion={enter(span(0, 0.5))}
    />`,
  `    <Shape
      geometry={wave} stroke={pink}
      draw={track(0).to(1, span(0, 1))}
    />`,
  `    <Shape
      geometry={rect(40, 40)} fill={teal}
      at={track(a).to(b, span(0, 1), spring)}
    />`,
  `    <Text font={mono} size={44}>
      {count(track(0).to(1280, span(0, 1.5)))}
    </Text>`,
];

const file = (n: number) =>
  [
    "export default scene(opts, () => (",
    "  <Group>",
    ...ELEMENTS.slice(0, n),
    "  </Group>",
    "));",
  ].join("\n");

const lands = [1.0, 2.7, 4.4, 6.1];
const plays = playsOf(lands);

/** The four tiles, two by two, filling the column beside the code. */
const GAP = 20;
const TILE: Vec = [(RESULT_COLUMN[2] - GAP) / 2, (RESULT_COLUMN[3] - GAP) / 2];

const corner = (i: number): Vec => [
  RESULT_COLUMN[0] + (i % 2) * (TILE[0] + GAP),
  RESULT_COLUMN[1] + Math.floor(i / 2) * (TILE[1] + GAP),
];

const middle: Vec = [TILE[0] / 2, TILE[1] / 2];

const wave = path()
  .moveTo([30, middle[1]])
  .curveTo([80, middle[1] - 70], [120, middle[1] + 70], [TILE[0] / 2, middle[1]])
  .curveTo(
    [TILE[0] - 120, middle[1] - 70],
    [TILE[0] - 80, middle[1] + 70],
    [TILE[0] - 30, middle[1]],
  );

const pieces: readonly ((at: number) => SceneElement)[] = [
  (at) => (
    <Shape
      geometry={circle(30)}
      at={middle}
      anchor="center"
      fill={ACCENTS[0]}
      motion={enter(span(at, 0.5), { from: { scale: 0 }, curve: ease.pop })}
    />
  ),
  (at) => (
    <Shape
      geometry={wave}
      stroke={{ color: ACCENTS[2], width: 4, cap: "round" }}
      draw={track(0).to(1, span(at, 1), ease.inOut)}
    />
  ),
  (at) => (
    <Shape
      geometry={rect(40, 40, { radius: 6 })}
      at={track<Vec>([36, middle[1] - 20]).to(
        [TILE[0] - 76, middle[1] - 20],
        span(at, spring.settle),
        spring,
      )}
      fill={ACCENTS[3]}
      opacity={track(0).to(1, span(at - 0.1, 0.1))}
    />
  ),
  (at) => (
    <Text
      font={mono}
      size={44}
      at={middle}
      anchor="center"
      fill={theme.text}
      opacity={track(0).to(1, span(at - 0.1, 0.1))}
    >
      {count(track(0).to(1280, span(at, 1.5), ease.out), { format: numeral({ separator: "," }) })}
    </Text>
  ),
];

/** Where each tile's top edge is, so Blip can stand on it. */
export const TILE_TOPS: readonly Vec[] = [0, 1, 2, 3].map((i) => [
  corner(i)[0] + TILE[0] - 60,
  corner(i)[1],
]);

export const BASICS = { plays } as const;

export const BasicsSlide = (): SceneElement => (
  <Builds
    name="scene.tsx"
    file={file}
    lands={lands}
    over={SHOTS.basics.over!}
    result={(times) => (
      <Group>
        {pieces.map((piece, i) => (
          <Group
            offset={corner(i)}
            motion={enter(span(times[i]! - 0.35, 0.3), {
              from: { opacity: 0, offset: [0, 8] },
              curve: ease.out,
            })}
          >
            <Shape
              geometry={rect(TILE[0], TILE[1], { radius: 12 })}
              fill={theme.surface}
              stroke={{ color: theme.line, width: 1 }}
            />
            {piece(times[i]!)}
          </Group>
        ))}
      </Group>
    )}
  />
);
