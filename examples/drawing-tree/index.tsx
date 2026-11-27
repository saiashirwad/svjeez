/** A tree sways in the wind over a meadow: branches are brushes, leaves and grass are scatters. */
import {
  Group,
  Shape,
  blob,
  brush,
  circle,
  ease,
  keyframes,
  line,
  polygon,
  pointAt,
  random,
  scatter,
  scene,
  span,
  spline,
  track,
  type Color,
  type SceneElement,
  type Vec,
} from "svjeez";

const PERIOD = 6;
const GROUND = 322;
const TRUNK_FOOT: Vec = [330, GROUND + 6];
const SWAY = [0, 2.2, 3.2, 4.2];

const LEAF = polygon([0, 0], [6, -4.5], [16, 0], [6, 4.5]);

const BLADE = polygon([0, -1.8], [22, 0], [0, 1.8]);

const PETAL = polygon([0, 0], [5, -3.5], [10, 0], [5, 3.5]);

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** A unit vector `deg` degrees clockwise from straight up. */
const up = (deg: number): Vec => [Math.sin(rad(deg)), -Math.cos(rad(deg))];

const next = random("tree");

interface Bough {
  readonly start: Vec;
  readonly points: Vec[];
  readonly widths: [number, number];
  readonly level: number;
  readonly kids: Bough[];
}

/** One branch from the origin of its own frame, with children rooted on points along its spline. */
const grow = (start: Vec, heading: number, length: number, width: number, level: number): Bough => {
  const bow = (next() - 0.5) * 22;
  const dir = up(heading);
  const side = up(heading + 90);
  const end: Vec = [dir[0] * length, dir[1] * length];

  // Two-point brushes are exact and tiny; only the thick limbs get a curve (a bent brush stores ~40 cubics).
  const points: Vec[] =
    level < 2
      ? [
          [0, 0],
          [dir[0] * length * 0.5 + side[0] * bow, dir[1] * length * 0.5 + side[1] * bow],
          end,
        ]
      : [[0, 0], end];

  const tip = width * 0.5;
  const centre = spline(points);
  const kids: Bough[] = [];

  if (level < 3) {
    const forks: [number, number][] =
      level === 0
        ? [
            [0.55, -38],
            [0.72, 34],
            [1, 6],
          ]
        : [
            [0.6, level % 2 ? -34 : 30],
            [1, level % 2 ? 26 : -22],
          ];

    for (const [share, turn] of forks) {
      const at = pointAt(centre, share).point;
      const here = width + (tip - width) * share;

      const kid = grow(
        at,
        heading + turn + (next() - 0.5) * 12,
        length * (0.68 + next() * 0.12),
        here * 0.85,
        level + 1,
      );

      kids.push(kid);
    }
  }

  return { start, points, widths: [width, tip], level, kids };
};

const TREE = grow([0, 0], 0, 112, 30, 0);

/** Sway for one branch level: a lag per level makes the wind travel up the tree. */
const sway = (level: number, strength: number) => {
  const lag = SWAY[level]! * 0.35;

  return keyframes([
    [0, 0],
    [1.4 + lag, strength],
    [3.9 + lag, -strength * 0.7],
    [PERIOD, 0],
  ]);
};

const LEAVES = ["#6A994E", "#7BAA55", "#8DB660", "#A7C957"] as const;

const Branch = ({ limb: b }: { limb: Bough }): SceneElement => (
  <Group offset={b.start} rotate={sway(b.level, 2.6 - b.level * 0.4)} origin={{ frame: [0, 0] }}>
    <Shape geometry={brush(b.points, b.widths)} fill="#5E4838" />
    {b.level >= 1 && (
      <Shape
        geometry={scatter(LEAF, {
          along: spline(b.points),
          count: [0, 3, 5, 8][b.level]!,
          angle: 52,
          alternate: true,
          jitter: 0.5,
          seed: b.level * 10 + Math.round(b.points.at(-1)![0]),
        })}
        fill={LEAVES[b.level]!}
      />
    )}
    {b.kids.map((kid, i) => (
      <Branch key={i} limb={kid} />
    ))}
  </Group>
);

const CLOUD: readonly Vec[] = [
  [-60, 8],
  [-44, -8],
  [-22, -18],
  [2, -12],
  [20, -22],
  [44, -8],
  [60, 8],
  [20, 16],
  [-26, 16],
];

const Cloud = ({ at, size, opacity }: { at: Vec; size: number; opacity: number }) => (
  <Shape
    geometry={blob(
      CLOUD.map(([x, y]): Vec => [x * size, y * size]),
      { round: 0.6 },
    )}
    offset={track<Vec>(at)
      .to([at[0] + 40, at[1]], span(0, PERIOD / 2), ease.inOut)
      .to(at, span(PERIOD / 2, PERIOD / 2), ease.inOut)}
    fill="#FFFFFF"
    opacity={opacity}
  />
);

const grassLayer = (seed: number, count: number, y: number, fill: Color, lean: number) => (
  <Group
    key={seed}
    skew={keyframes([
      [0, 0],
      [1.8 + seed * 0.3, lean],
      [4.2 + seed * 0.3, -lean * 0.6],
      [PERIOD, 0],
    ])}
    origin={{ frame: [320, y] }}
  >
    <Shape
      geometry={scatter(BLADE, {
        along: line([0, y], [640, y]),
        count,
        angle: -90,
        jitter: 0.8,
        seed,
      })}
      fill={fill}
    />
  </Group>
);

const FLOWERS = [
  [70, 352, "#F4A6B7"],
  [150, 366, "#FFFFFF"],
  [232, 350, "#F2C14E"],
  [420, 362, "#F4A6B7"],
  [500, 350, "#FFFFFF"],
  [580, 368, "#F2C14E"],
] as const;

export default scene(
  { size: [640, 400], duration: PERIOD, title: "Tree in the wind" },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#CFE8F3" />
      <Cloud at={[110, 70]} size={0.9} opacity={0.95} />
      <Cloud at={[470, 48]} size={0.7} opacity={0.85} />
      <Cloud at={[300, 110]} size={0.5} opacity={0.7} />
      <Shape
        geometry={blob(
          [
            [-20, 330],
            [120, 290],
            [300, 302],
            [470, 280],
            [660, 306],
            [660, 410],
            [-20, 410],
          ],
          { round: 0.5 },
        )}
        fill="#B7D39A"
      />
      {grassLayer(1, 110, 336, "#7FA650", 3)}
      <Group offset={TRUNK_FOOT}>
        <Branch limb={TREE} />
      </Group>
      {grassLayer(2, 120, 352, "#5E8C3A", 4)}
      {FLOWERS.map(([x, y, fill]) => (
        <Group key={x} offset={[x, y]}>
          <Shape
            geometry={brush(
              [
                [0, 0],
                [1, -14],
              ],
              2,
            )}
            fill="#4F772D"
          />
          <Shape
            geometry={scatter(PETAL, { along: circle(4), count: 6, angle: -90 })}
            offset={[1, -16]}
            fill={fill}
          />
          <Shape geometry={circle(2.6)} offset={[1, -16]} fill="#E07A5F" />
        </Group>
      ))}
      {grassLayer(3, 100, 392, "#47702A", 5)}
    </Group>
  ),
);
