/** @jsxImportSource svjeez */
import {
  Clip,
  def,
  ease,
  motion,
  random,
  render,
  sampled,
  span,
  spline,
  type Point,
  type SvgNode,
} from "svjeez";
import type { Area } from "../play/walk";
import type { Hex } from "./color";
import { DAY, daylight } from "./daylight";
import {
  Bench,
  Bush,
  Cottage,
  FenceAcross,
  FenceDown,
  Flower,
  Glint,
  Glow,
  HayBale,
  Lamp,
  LilyPad,
  Mailbox,
  Reeds,
  Rock,
  Scarecrow,
  ShippingBin,
  Sign,
  Stump,
  Tree,
  Well,
  Windmill,
  type TreeKind,
} from "./props";

/** The side of one map square, in px. */
export const TILE = 48;

/**
 * The ground, one character per square: `.` grass, `,` meadow, `w` water, `b` planks over water, `p` path,
 * `s` soil that can be farmed.
 */
const MAP = [
  ".........................ww.......",
  ".........................ww.......",
  ".........................ww.......",
  ".........................ww.......",
  ".........................ww.......",
  ".........................ww.......",
  ".........................ww...p...",
  "........p................ww...p...",
  "........pppppppppppppppppbbppppp..",
  "........p.....p..........ww.......",
  "........p.....p..........ww.......",
  ".....ssssss...p.,,,,,....ww.......",
  ".....ssssss...p.,,,,,....ww.......",
  ".....ssssss...p.,,,,,...wwww......",
  ".....ssssss...p.,,,,,.wwwwwwww....",
  "..............p.,,,,,wwwwwwwwww...",
  "..............p.,,,,,bbwwwwwwww...",
  "..............p.,,,,,.wwwwwwww....",
  "..............p.,,,,,..wwwwww.....",
  "..............p...................",
  "..............p...................",
  "..............p...................",
  "..............p...................",
  "..............p...................",
] as const;

const COLUMNS = 34;
const ROWS = MAP.length;

for (const [row, line] of MAP.entries())
  if (line.length !== COLUMNS)
    throw new Error(`Map row ${row} is ${line.length} squares wide, not ${COLUMNS}.`);

export const WORLD = { width: COLUMNS * TILE, height: ROWS * TILE } as const;

/** Something standing on the ground. The stage draws things in order of `y`, so a villager can walk behind one. */
interface Thing {
  readonly x: number;
  /** Where it meets the ground. */
  readonly y: number;
  readonly node: SvgNode;
  /** What cannot be walked through, measured from `x, y`. */
  readonly solid?: Area;
  /** Lights it carries: where each is, from `x, y`, and how far it reaches. */
  readonly lights?: readonly (readonly [x: number, y: number, r: number])[];
}

/** A rendered world and what the game needs to know about it. */
export interface World {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  /** Everything that blocks walking: water and the foot of each thing. */
  readonly solids: readonly Area[];
  /** The top left corner of every square of soil. */
  readonly soil: readonly Point[];
  readonly places: {
    readonly spawn: Point;
    readonly door: Point;
    readonly bin: Point;
    readonly well: Point;
    readonly mill: Point;
    readonly dock: Point;
    readonly pen: Point;
  };
}

const squareAt = (column: number, row: number): string => MAP[row]?.[column] ?? ".";

const squares = (kinds: string): Point[] => {
  const found: Point[] = [];

  for (let row = 0; row < ROWS; row++)
    for (let column = 0; column < COLUMNS; column++)
      if (kinds.includes(squareAt(column, row))) found.push({ x: column * TILE, y: row * TILE });

  return found;
};

const outline = (at: readonly Point[]): string =>
  at.map(({ x, y }) => `M${x} ${y}h${TILE}v${TILE}h${-TILE}z`).join("");

/** Squares drawn as one blob: a stroke in the fill's color rounds the outer corners. */
const Blob = ({
  d,
  fill,
  grow,
}: {
  readonly d: string;
  readonly fill: Hex;
  readonly grow: number;
}): SvgNode => <path d={d} fill={fill} stroke={fill} strokeWidth={grow} strokeLinejoin="round" />;

const Ground = (): SvgNode => {
  const next = random("ground");
  const grass = squares(".,");
  const water = outline(squares("wb"));
  const path = outline(squares("p"));
  const soil = squares("s");
  const tufts: string[] = [];
  const pebbles: string[] = [];

  for (let i = 0; i < 520; i++) {
    const square = grass[Math.floor(next() * grass.length)];

    if (!square) continue;
    const x = Math.round(square.x + 6 + next() * (TILE - 16));
    const y = Math.round(square.y + 10 + next() * (TILE - 12));
    tufts.push(`M${x} ${y}l-2 -5M${x + 3} ${y}l1 -7M${x + 6} ${y}l3 -4`);
  }

  for (const square of squares("p"))
    for (let i = 0; i < 2; i++) {
      const x = Math.round(square.x + 6 + next() * (TILE - 12));
      const y = Math.round(square.y + 6 + next() * (TILE - 12));
      pebbles.push(`M${x} ${y}h3`);
    }

  return (
    <>
      <rect width={WORLD.width} height={WORLD.height} fill="#8fc46a" />
      <Blob d={outline(squares(","))} fill="#a3d277" grow={26} />
      <path
        d={tufts.slice(0, 300).join("")}
        fill="none"
        stroke="#74b05a"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d={tufts.slice(300).join("")}
        fill="none"
        stroke="#b5df8c"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Blob d={water} fill="#e9d8a6" grow={24} />
      <Blob d={water} fill="#8fd0e2" grow={10} />
      <path d={water} fill="#62b5d1" />
      <Blob d={path} fill="#c9a871" grow={18} />
      <Blob d={path} fill="#e2c48d" grow={10} />
      <path d={pebbles.join("")} stroke="#cfae78" strokeWidth={3} strokeLinecap="round" />
      <Blob d={outline(soil)} fill="#6f4a30" grow={14} />
      <Blob d={outline(soil)} fill="#8a5f3f" grow={6} />
      <path
        d={soil
          .map(({ x, y }) => `M${x + 5} ${y + 12}h38M${x + 5} ${y + 24}h38M${x + 5} ${y + 36}h38`)
          .join("")}
        stroke="#7a5236"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {squares("b").map(({ x, y }) => (
        <>
          <rect x={x} y={y + 3} width={TILE} height={TILE - 6} fill="#c79a63" />
          <path
            d={`M${x + 12} ${y + 3}v42M${x + 24} ${y + 3}v42M${x + 36} ${y + 3}v42`}
            stroke="#a8683f"
            strokeWidth={1.6}
          />
          <rect x={x} y={y + 1} width={TILE} height={5} fill="#8b5a3c" />
          <rect x={x} y={y + TILE - 6} width={TILE} height={5} fill="#8b5a3c" />
        </>
      ))}
    </>
  );
};

const FLOWER_COLORS: readonly Hex[] = ["#f8f4ec", "#f7a8c4", "#f6d55c", "#b99be8", "#ff8f6b"];

/** Flowers, lily pads and glints: decor that lies flat, so nothing walks behind it. */
const Decor = (): SvgNode => {
  const next = random("decor");
  const grass = squares(".,");
  const meadow = squares(",");

  const water = squares("w").filter(
    ({ x, y }) =>
      squareAt(x / TILE - 1, y / TILE) !== "." && squareAt(x / TILE + 1, y / TILE) !== ".",
  );

  const flowers: SvgNode[] = [];
  const glints: SvgNode[] = [];

  for (let i = 0; i < 110; i++) {
    const from = i < 50 ? meadow : grass;
    const square = from[Math.floor(next() * from.length)];
    const color = FLOWER_COLORS[Math.floor(next() * FLOWER_COLORS.length)];

    if (!square || !color) continue;
    const x = Math.round(square.x + 6 + next() * 36);
    const y = Math.round(square.y + 14 + next() * 30);

    flowers.push(
      <g transform={`translate(${x} ${y})`}>
        <Flower color={color} seed={`flower-${i % 7}`} />
      </g>,
    );
  }

  for (let i = 0; i < 16; i++) {
    const square = water[Math.floor(next() * water.length)];

    if (!square) continue;

    glints.push(
      <g
        transform={`translate(${Math.round(square.x + 8 + next() * 32)} ${Math.round(square.y + 8 + next() * 32)})`}
      >
        <Glint at={Math.round(next() * 5)} period={i % 2 === 0 ? 4 : 6} />
      </g>,
    );
  }

  const pads: readonly (readonly [number, number])[] = [
    [1150, 772],
    [1290, 800],
    [1385, 742],
    [1222, 862],
    [1335, 884],
    [1262, 724],
    [1420, 820],
  ];

  return (
    <>
      {flowers}
      {glints}
      {pads.map(([x, y], i) => (
        <g transform={`translate(${x} ${y})`}>
          <LilyPad seed={`pad-${i}`} bloom={i % 2 === 0} />
        </g>
      ))}
    </>
  );
};

const foot = (x: number, y: number, width: number, height: number): Area => ({
  x,
  y,
  width,
  height,
});

const TRUNK = foot(-9, -10, 18, 12);
const POST = foot(-4, -5, 8, 7);

const tree = (x: number, y: number, kind: TreeKind, size = 1): Thing => ({
  x,
  y,
  node: <Tree kind={kind} size={size} seed={`tree-${(x + y) % 5}`} still={(x + y) % 3 === 0} />,
  solid: TRUNK,
});

const things = (): Thing[] => {
  const next = random("forest");
  const placed: Thing[] = [];
  const kinds: readonly TreeKind[] = ["oak", "oak", "pine", "oak", "pine", "blossom"];

  for (let row = 0; row < ROWS; row++)
    for (let column = 0; column < COLUMNS; column++) {
      const edge = Math.min(column, row, COLUMNS - 1 - column, ROWS - 1 - row);
      const chance = edge < 2 ? 0.62 : edge === 2 ? 0.22 : 0;
      const roll = next();
      const kind = kinds[Math.floor(next() * kinds.length)] ?? "oak";
      const dx = next() * 24 - 12;
      const dy = next() * 16;
      const size = 0.85 + next() * 0.3;

      if (roll >= chance) continue;

      const clear = [-1, 0, 1].every(
        (by) => squareAt(column + by, row) === "." && squareAt(column, row + by) === ".",
      );

      if (clear)
        placed.push(
          tree(Math.round(column * TILE + 24 + dx), Math.round(row * TILE + 30 + dy), kind, size),
        );
    }

  const fence: Thing[] = [];

  for (let x = 216; x < 552; x += TILE) {
    const gate = x + TILE > 384 && x < 432;

    if (!gate)
      fence.push({ x, y: 510, node: <FenceAcross width={TILE} />, solid: foot(0, -6, TILE, 6) });
    fence.push({ x, y: 750, node: <FenceAcross width={TILE} />, solid: foot(0, -6, TILE, 6) });
  }

  for (let y = 558; y <= 750; y += TILE)
    for (const x of [216, 552])
      fence.push({ x, y, node: <FenceDown height={TILE} />, solid: foot(-3, -TILE, 6, TILE) });

  const sunflowers: Thing[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    x: 792 + i * 34,
    y: 566 + (i % 2) * 12,
    node: <Flower color="#f6c445" seed={`sun-${i}`} tall />,
  }));

  const reeds: Thing[] = [
    [1034, 770],
    [1012, 812],
    [1478, 716],
    [1404, 936],
    [1096, 906],
    [1196, 690],
  ].map(([x = 0, y = 0], i) => ({ x, y, node: <Reeds seed={`reeds-${i}`} /> }));

  return [
    ...placed,
    ...fence,
    ...sunflowers,
    ...reeds,
    {
      x: 408,
      y: 336,
      node: <Cottage />,
      solid: foot(-112, -84, 224, 84),
      lights: [
        [-74, -52, 54],
        [74, -52, 54],
      ],
    },
    { x: 1464, y: 288, node: <Windmill />, solid: foot(-42, -34, 84, 34), lights: [[0, -84, 40]] },
    { x: 792, y: 270, node: <Well />, solid: foot(-25, -20, 50, 24) },
    { x: 300, y: 356, node: <Mailbox />, solid: POST },
    { x: 566, y: 352, node: <ShippingBin />, solid: foot(-23, -16, 46, 18) },
    { x: 180, y: 650, node: <Scarecrow />, solid: POST },
    { x: 888, y: 492, node: <Bench />, solid: foot(-28, -12, 56, 14) },
    { x: 1150, y: 474, node: <Sign text="POND" />, solid: POST },
    { x: 760, y: 1010, node: <Sign text="SOUTH" />, solid: POST },
    { x: 1340, y: 566, node: <HayBale />, solid: foot(-21, -16, 42, 18) },
    { x: 1388, y: 584, node: <HayBale />, solid: foot(-21, -16, 42, 18) },
    { x: 1366, y: 548, node: <HayBale />, solid: foot(-21, -16, 42, 18) },
    ...[
      [600, 378],
      [984, 378],
      [1380, 378],
      [748, 600],
    ].map(([x = 0, y = 0]): Thing => ({
      x,
      y,
      node: <Lamp />,
      solid: POST,
      lights: [[0, -66, 84]],
    })),
    tree(190, 304, "blossom", 1.05),
    tree(646, 262, "blossom", 0.95),
    tree(800, 716, "apple", 1),
    tree(900, 900, "apple", 1.1),
    tree(560, 140, "oak", 1.15),
    tree(250, 180, "oak", 1),
    tree(1000, 200, "oak", 1.2),
    tree(1090, 150, "pine", 1),
    tree(1380, 150, "pine", 1.1),
    tree(1560, 440, "oak", 1),
    tree(420, 920, "oak", 1.15),
    tree(540, 1000, "pine", 1),
    tree(1130, 1040, "oak", 1.1),
    tree(1500, 900, "blossom", 1),
    ...[
      [620, 474],
      [1044, 300],
      [470, 830],
      [1506, 760],
    ].map(([x = 0, y = 0]) => ({ x, y, node: <Bush />, solid: foot(-14, -9, 28, 11) })),
    ...[
      [1568, 620],
      [120, 486],
      [900, 1060],
    ].map(([x = 0, y = 0]) => ({ x, y, node: <Bush berries />, solid: foot(-14, -9, 28, 11) })),
    ...[
      [1164, 640],
      [1330, 1010],
      [690, 980],
      [96, 800],
    ].map(([x = 0, y = 0]) => ({ x, y, node: <Rock />, solid: foot(-14, -9, 28, 11) })),
    ...[
      [968, 560],
      [300, 900],
    ].map(([x = 0, y = 0]) => ({ x, y, node: <Stump />, solid: foot(-12, -9, 24, 11) })),
  ];
};

const cloud = def.radialGradient(
  { cx: 0.5, cy: 0.5, r: 0.5 },
  <>
    <stop offset={0} stopColor="#274060" stopOpacity={0.16} />
    <stop offset={0.7} stopColor="#274060" stopOpacity={0.1} />
    <stop offset={1} stopColor="#274060" stopOpacity={0} />
  </>,
);

const Butterfly = ({
  around,
  color,
  seed,
  lap,
}: {
  readonly around: Point;
  readonly color: Hex;
  readonly seed: string;
  readonly lap: number;
}): SvgNode => {
  const next = random(seed);

  const stops = Array.from({ length: 7 }, (_, i) => {
    const turn = (i / 7) * Math.PI * 2;
    const reach = 50 + next() * 90;

    return { x: around.x + Math.cos(turn) * reach, y: around.y + Math.sin(turn) * reach * 0.6 };
  });

  const route = spline([...stops, ...stops.slice(0, 1)]);

  const flight = sampled(
    { at: 0, over: lap },
    (t) => {
      const { x, y } = route.point((t / lap) * route.legs);

      return { x, y: y + Math.sin(t * 5) * 4 };
    },
    { tolerance: { translate: 1.5 }, precision: 1 },
  ).loop(lap);

  const flap = motion({ opacity: 1 })
    .set({ opacity: 0 }, 0.12)
    .set({ opacity: 1 }, 0.24)
    .loop(0.24);

  return (
    <g animation={flight}>
      <g animation={flap}>
        <ellipse cx={-4} cy={-2} rx={4.5} ry={5.5} fill={color} />
        <ellipse cx={4} cy={-2} rx={4.5} ry={5.5} fill={color} />
      </g>
      <ellipse cx={-1.5} cy={-2} rx={1.6} ry={5} fill={color} />
      <ellipse cx={1.5} cy={-2} rx={1.6} ry={5} fill={color} />
      <rect x={-0.8} y={-6} width={1.6} height={8} rx={0.8} fill="#3a2a26" />
    </g>
  );
};

const Sky = (): SvgNode => (
  <>
    <Butterfly around={{ x: 880, y: 660 }} color="#f7a8c4" seed="b1" lap={24} />
    <Butterfly around={{ x: 940, y: 760 }} color="#f8f4ec" seed="b2" lap={30} />
    <Butterfly around={{ x: 380, y: 620 }} color="#f6d55c" seed="b3" lap={20} />
    <Butterfly around={{ x: 1240, y: 560 }} color="#b99be8" seed="b4" lap={40} />
    <Butterfly around={{ x: 560, y: 460 }} color="#ff8f6b" seed="b5" lap={24} />
    {[
      [0, 260, 80],
      [34, 700, 120],
      [70, 980, 80],
    ].map(([at = 0, y = 0, lap = 80]) => (
      <Clip at={at}>
        <ellipse
          cx={0}
          cy={y}
          rx={260}
          ry={110}
          fill={cloud}
          animation={motion({ x: -320 })
            .to({ x: WORLD.width + 320 }, span(0, lap), ease.linear)
            .loop(lap)}
        />
      </Clip>
    ))}
  </>
);

/**
 * Draw Mossbell. The stage looks for the `data-layer` groups: villagers go into `things`, among the trees, and
 * effects into `effects`, under the light.
 */
export const buildWorld = (): World => {
  const standing = things().sort((a, b) => a.y - b.y);

  const svg = render(
    {
      width: WORLD.width,
      height: WORLD.height,
      duration: DAY,
      title: "Mossbell",
      desc: "A valley farm: a cottage, a fenced plot, a stream that runs into a pond, and a windmill past the bridge.",
      prefix: "world-",
      reducedMotion: false,
    },
    <>
      <g data-layer="ground">
        <Ground />
        <Decor />
      </g>
      <g data-layer="things">
        {standing.map(({ x, y, node }) => (
          <g data-y={y} transform={`translate(${x} ${y})`}>
            {node}
          </g>
        ))}
      </g>
      <g data-layer="sky" style="pointer-events:none">
        <Sky />
      </g>
      <g data-layer="effects" style="pointer-events:none" />
      <rect
        data-layer="light"
        width={WORLD.width}
        height={WORLD.height}
        fill="#ffffff"
        style="mix-blend-mode:multiply;pointer-events:none"
        animation={daylight}
      />
      <g data-layer="glow" style="pointer-events:none">
        {standing.flatMap(({ x, y, lights }) =>
          (lights ?? []).map(([dx, dy, r]) => (
            <g transform={`translate(${x + dx} ${y + dy})`}>
              <Glow r={r} />
            </g>
          )),
        )}
      </g>
    </>,
  );

  const solids = [
    ...squares("w").map(({ x, y }) => foot(x, y, TILE, TILE)),
    ...standing.flatMap(({ x, y, solid }) =>
      solid ? [foot(x + solid.x, y + solid.y, solid.width, solid.height)] : [],
    ),
  ];

  return {
    svg,
    width: WORLD.width,
    height: WORLD.height,
    solids,
    soil: squares("s"),
    places: {
      spawn: { x: 408, y: 404 },
      door: { x: 408, y: 340 },
      bin: { x: 566, y: 352 },
      well: { x: 792, y: 270 },
      mill: { x: 1464, y: 292 },
      dock: { x: 1040, y: 792 },
      pen: { x: 1400, y: 660 },
    },
  };
};
