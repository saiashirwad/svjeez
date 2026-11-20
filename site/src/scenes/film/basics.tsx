import {
  Group,
  Shape,
  circle,
  ease,
  enter,
  path,
  rect,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Builds, playsOf } from "./builds";
import { ACCENTS, RESULT_COLUMN, SHOTS, spring, theme } from "./kit";

// The first code slide: a scene grows an element at a time, and each one plays in its own tile the moment its code
// lands. A circle pops in, a wave draws itself, a square springs across. Every prop sits on its own line.

const ELEMENTS = [
  `    <Shape
      geometry={circle(30)}
      fill={blue}
      motion={enter(span(0, 0.5))}
    />`,
  `    <Shape
      geometry={wave}
      stroke={pink}
      draw={track(0).to(1, span(0, 1))}
    />`,
  `    <Shape
      geometry={rect(40, 40)}
      fill={teal}
      at={track(a).to(b, span(0, 1), spring)}
    />`,
];

const file = (n: number) =>
  [
    "export default scene(opts, () => (",
    "  <Group>",
    ...ELEMENTS.slice(0, n),
    "  </Group>",
    "));",
  ].join("\n");

const lands = [1.0, 3.0, 5.0];
const plays = playsOf(lands);

/** Two tiles on top, and one the width of both below them for the square to cross. */
const GAP = 20;
const HALF = (RESULT_COLUMN[2] - GAP) / 2;
const TALL = (RESULT_COLUMN[3] - GAP) / 2;

const TILES: readonly { readonly at: Vec; readonly size: Vec }[] = [
  { at: [RESULT_COLUMN[0], RESULT_COLUMN[1]], size: [HALF, TALL] },
  { at: [RESULT_COLUMN[0] + HALF + GAP, RESULT_COLUMN[1]], size: [HALF, TALL] },
  { at: [RESULT_COLUMN[0], RESULT_COLUMN[1] + TALL + GAP], size: [RESULT_COLUMN[2], TALL] },
];

const waveIn = ([w, h]: Vec) =>
  path()
    .moveTo([30, h / 2])
    .curveTo([80, h / 2 - 70], [120, h / 2 + 70], [w / 2, h / 2])
    .curveTo([w - 120, h / 2 - 70], [w - 80, h / 2 + 70], [w - 30, h / 2]);

const pieces: readonly ((at: number, size: Vec) => SceneElement)[] = [
  (at, [w, h]) => (
    <Shape
      geometry={circle(34)}
      at={[w / 2, h / 2]}
      anchor="center"
      fill={ACCENTS[0]}
      motion={enter(span(at, 0.5), { from: { scale: 0 }, curve: ease.pop })}
    />
  ),
  (at, size) => (
    <Shape
      geometry={waveIn(size)}
      stroke={{ color: ACCENTS[2], width: 4, cap: "round" }}
      draw={track(0).to(1, span(at, 1), ease.inOut)}
    />
  ),
  (at, [w, h]) => (
    <Shape
      geometry={rect(44, 44, { radius: 8 })}
      at={track<Vec>([40, h / 2 - 22]).to([w - 84, h / 2 - 22], span(at, spring.settle), spring)}
      fill={ACCENTS[3]}
      opacity={track(0).to(1, span(at - 0.1, 0.1))}
    />
  ),
];

/** Where each tile's top edge is, so Blip can stand on it. */
export const TILE_TOPS: readonly Vec[] = TILES.map(({ at, size }) => [at[0] + size[0] - 60, at[1]]);
export const BASICS = { plays } as const;

export const BasicsSlide = (): SceneElement => (
  <Builds
    name="scene.tsx"
    file={file}
    lands={lands}
    over={SHOTS.basics.over!}
    result={(times) => (
      <Group>
        {TILES.map(({ at, size }, i) => (
          <Group
            offset={at}
            motion={enter(span(times[i]! - 0.35, 0.3), {
              from: { opacity: 0, offset: [0, 8] },
              curve: ease.out,
            })}
          >
            <Shape
              geometry={rect(size[0], size[1], { radius: 12 })}
              fill={theme.surface}
              stroke={{ color: theme.line, width: 1 }}
            />
            {pieces[i]!(times[i]!, size)}
          </Group>
        ))}
      </Group>
    )}
  />
);
