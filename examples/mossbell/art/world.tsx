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
  type Color,
  type Point,
  type SvgNode,
} from "svjeez";
import type { Area } from "../play/walk";
import { shade, type Hex } from "./color";
import { DAY, daylight } from "./daylight";
import { canvas, Flipbook, Pixels, PX, sketch, type Canvas } from "./pixel";
import {
  Bench,
  Bush,
  Cottage,
  FenceAcross,
  FenceDown,
  Glint,
  Glow,
  HayBale,
  Lamp,
  Mailbox,
  Reeds,
  Rock,
  Scarecrow,
  ShippingBin,
  Sign,
  Stump,
  Sunflower,
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

/** Pixels to a map square. */
const CELL = TILE / PX;

const squareAt = (column: number, row: number): string => MAP[row]?.[column] ?? ".";

const squares = (kinds: string): Point[] => {
  const found: Point[] = [];

  for (let row = 0; row < ROWS; row++)
    for (let column = 0; column < COLUMNS; column++)
      if (kinds.includes(squareAt(column, row))) found.push({ x: column * TILE, y: row * TILE });

  return found;
};

/** Squares that join into one shape: planks lie over water, so the pond runs on under them. */
const family = (kind: string): string => (kind === "b" ? "w" : kind);

/**
 * What the ground is at one pixel. It is the square's kind, except in the outer corners of a shape, where a few pixels
 * go back to grass so ponds, paths and plots have rounded corners.
 */
const groundAt = (x: number, y: number): string => {
  const column = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);
  const kind = squareAt(column, row);

  if (kind === ".") return kind;
  const lx = x - column * CELL;
  const ly = y - row * CELL;
  const dx = lx < 3 ? -1 : lx > CELL - 4 ? 1 : 0;
  const dy = ly < 3 ? -1 : ly > CELL - 4 ? 1 : 0;

  const joins = (dc: number, dr: number): boolean =>
    column + dc < 0 ||
    column + dc >= COLUMNS ||
    row + dr < 0 ||
    row + dr >= ROWS ||
    family(squareAt(column + dc, row + dr)) === family(kind);

  if (dx === 0 || dy === 0 || joins(dx, 0) || joins(0, dy)) return kind;
  const fromCorner = (dx < 0 ? lx : CELL - 1 - lx) + (dy < 0 ? ly : CELL - 1 - ly);

  return fromCorner < 3 ? "." : kind;
};

/** True when a pixel within `reach` of this one, straight across or up and down, is ground of another family. */
const edge = (x: number, y: number, reach: number, kind: string): boolean => {
  for (let by = 1; by <= reach; by++)
    if (AROUND.some(([dx, dy]) => family(groundAt(x + dx * by, y + dy * by)) !== kind)) return true;

  return false;
};

/** A number from 0 up to 1 that is always the same for the same pixel. */
const noise = (x: number, y: number): number => {
  const mixed = Math.imul(x * 374761393 + y * 668265263, 1274126177);

  return ((mixed ^ (mixed >>> 13)) >>> 0) / 4294967296;
};

const GRASS: Hex = "#86c25a";

const AROUND = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const waterWithin = (x: number, y: number, reach: number): boolean => {
  for (let by = 1; by <= reach; by++)
    if (AROUND.some(([dx, dy]) => family(groundAt(x + dx * by, y + dy * by)) === "w")) return true;

  return false;
};

const inkAt = (x: number, y: number): Color | undefined => {
  const kind = groundAt(x, y);
  const lx = x % CELL;
  const ly = y % CELL;
  const roll = noise(x, y);

  if (kind === "." || kind === ",") {
    if (waterWithin(x, y, 1)) return "#b89a66";

    if (waterWithin(x, y, 3)) return "#e6d49a";

    if (kind === ",") return edge(x, y, 2, ",") && (x + y) % 2 === 0 ? undefined : "#9ed46f";

    return undefined;
  }

  if (kind === "w") {
    if ([1, 2, 3].some((by) => family(groundAt(x, y - by)) !== "w")) return "#3f8fc2";

    if (edge(x, y, 1, "w")) return "#a6dcee";

    return noise(Math.floor(x / 3), y) < 0.035 ? "#8fd0ea" : "#4fa8dc";
  }

  if (kind === "b") {
    if (ly < 2 || ly > CELL - 3) return "#8b5a3c";

    return ly === 2 ? "#a8683f" : lx % 4 === 3 ? "#a8683f" : "#c79a63";
  }

  if (kind === "p") {
    if (edge(x, y, 1, "p") && groundAt(x + 1, y) !== "b" && groundAt(x - 1, y) !== "b")
      return "#c49a5c";

    return roll < 0.03 ? "#cfa96c" : roll > 0.975 ? "#ecd09a" : "#e0bf85";
  }

  if (edge(x, y, 1, "s")) return "#5a3823";

  return ly % 5 === 4 ? "#6a4329" : ly % 5 === 0 ? "#946a44" : "#80553a";
};

const FLOWERS: readonly Hex[] = ["#f8f4ec", "#f7a8c4", "#f6d55c", "#b99be8", "#ff8f6b"];

/** Wildflowers, a few pixels each: a daisy, a tulip, bells and a bud. */
const BLOOMS: readonly (readonly string[])[] = [
  [".p.p.", "ppypp", ".q.q.", "..g..", ".Gg.."],
  ["p.p.p", "ppppp", "qpppq", ".qqq.", "..g..", "G.g..", ".Gg.."],
  ["..p..", ".pq..", "..g.p", ".pg.q", ".qg..", "..gG."],
  [".p.", "pyp", ".q.", ".g."],
];

const PADS: readonly (readonly [number, number])[] = [
  [383, 257],
  [430, 266],
  [461, 247],
  [407, 287],
  [445, 294],
  [420, 241],
  [473, 273],
];

/** The whole ground as one canvas: terrain, then tufts, flowers and lily pads on top. Grass itself is left empty. */
const ground = (): Canvas => {
  const wide = COLUMNS * CELL;
  const tall = ROWS * CELL;
  const c = canvas(wide, tall);
  const next = random("ground");

  for (let y = 0; y < tall; y++)
    for (let x = 0; x < wide; x++) {
      const ink = inkAt(x, y);

      if (ink) c.dot(x, y, ink);
    }

  const grassy = (x: number, y: number): boolean =>
    [-2, 0, 2].every(
      (by) => ".,".includes(groundAt(x + by, y)) && ".,".includes(groundAt(x, y + by)),
    ) && c.at(x, y) !== "#e6d49a";

  for (let i = 0; i < 1500; i++) {
    const x = Math.floor(next() * (wide - 4)) + 1;
    const y = Math.floor(next() * (tall - 4)) + 2;
    const ink = next() < 0.6 ? "#6fae4e" : "#a8dc7c";

    if (grassy(x, y))
      c.dot(x, y, ink)
        .dot(x + 1, y - 1, ink)
        .dot(x + 2, y, ink);
  }

  for (let i = 0; i < 230; i++) {
    const meadow = i < 110;
    const x = Math.floor(next() * (wide - 8)) + 1;
    const y = Math.floor(next() * (tall - 10)) + 2;
    const petal = FLOWERS[Math.floor(next() * FLOWERS.length)] ?? "#f8f4ec";
    const rows = BLOOMS[Math.floor(next() * BLOOMS.length)] ?? [];

    if (
      [0, 4].every((dx) => [0, 6].every((dy) => grassy(x + dx, y + dy))) &&
      (!meadow || groundAt(x, y) === ",")
    )
      c.stamp(
        sketch(
          rows,
          new Map<string, Color>([
            ["p", petal],
            ["q", shade(petal, -0.18)],
            ["y", petal === "#f6d55c" ? "#e4572e" : "#f6d55c"],
            ["g", "#3f8a45"],
            ["G", "#74bd63"],
          ]),
        ),
        x,
        y,
      );
  }

  for (const [i, [x, y]] of PADS.entries()) {
    c.oval(x, y, 3.5, 2.5, "#4f9a6a")
      .oval(x - 0.5, y - 0.5, 2, 1.2, "#6fb884")
      .dot(x + 2, y, "#4fa8dc");

    if (i % 2 === 0) c.dot(x - 1, y - 1, "#f8d7e3").dot(x, y - 1, "#f6d55c");
  }

  return c;
};

const Glints = (): SvgNode => {
  const next = random("glints");

  const open = squares("w").filter(
    ({ x, y }) =>
      squareAt(x / TILE, y / TILE - 1) === "w" && squareAt(x / TILE - 1, y / TILE) !== ".",
  );

  return (
    <>
      {Array.from({ length: 18 }, (_, i) => {
        const square = open[Math.floor(next() * open.length)] ?? { x: 0, y: 0 };
        const x = square.x + (2 + Math.floor(next() * 12)) * PX;
        const y = square.y + (2 + Math.floor(next() * 12)) * PX;

        return (
          <g transform={`translate(${x} ${y})`}>
            <Glint at={Math.round(next() * 5)} period={i % 2 === 0 ? 4 : 6} />
          </g>
        );
      })}
    </>
  );
};

/** Something standing on the ground. The stage draws things in order of `y`, so a villager can walk behind one. */
interface Thing {
  readonly x: number;
  /** Where it meets the ground. */
  readonly y: number;
  readonly node: SvgNode;
  /** What cannot be walked through, measured from `x, y`. */
  readonly solid?: Area;
  /** Lights it carries: where each is, from `x, y`, and how far it reaches, in pixels. */
  readonly lights?: readonly (readonly [x: number, y: number, r: number])[];
}

/** A rendered world and what the game needs to know about it. */
export interface World {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  /** The side of one art pixel, in world px. */
  readonly grid: number;
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

const foot = (x: number, y: number, width: number, height: number): Area => ({
  x,
  y,
  width,
  height,
});

/** The nearest whole pixel. */
const snap = (value: number): number => Math.round(value / PX) * PX;

const TRUNK = foot(-9, -10, 18, 12);
const POST = foot(-5, -5, 10, 7);
const LOW = foot(-18, -10, 36, 12);

const tree = (x: number, y: number, kind: TreeKind): Thing => ({
  x: snap(x),
  y: snap(y),
  node: <Tree kind={kind} pick={x + y} />,
  solid: TRUNK,
});

const at = (
  spots: readonly (readonly [number, number])[],
  make: () => Omit<Thing, "x" | "y">,
): Thing[] => spots.map(([x, y]) => ({ x: snap(x), y: snap(y), ...make() }));

const things = (): Thing[] => {
  const next = random("forest");
  const placed: Thing[] = [];
  const kinds: readonly TreeKind[] = ["oak", "oak", "pine", "oak", "pine", "blossom"];

  for (let row = 0; row < ROWS; row++)
    for (let column = 0; column < COLUMNS; column++) {
      const fromEdge = Math.min(column, row, COLUMNS - 1 - column, ROWS - 1 - row);
      const chance = fromEdge < 2 ? 0.62 : fromEdge === 2 ? 0.22 : 0;
      const roll = next();
      const kind = kinds[Math.floor(next() * kinds.length)] ?? "oak";
      const dx = next() * 24 - 12;
      const dy = next() * 16;

      if (roll >= chance) continue;

      const clear = [-1, 0, 1].every(
        (by) => squareAt(column + by, row) === "." && squareAt(column, row + by) === ".",
      );

      if (clear) placed.push(tree(column * TILE + 24 + dx, row * TILE + 34 + dy, kind));
    }

  const fence: Thing[] = [];

  for (let x = 216; x < 552; x += TILE) {
    const gate = x + TILE > 384 && x < 432;

    if (!gate) fence.push({ x, y: 510, node: <FenceAcross />, solid: foot(0, -6, TILE, 6) });
    fence.push({ x, y: 750, node: <FenceAcross />, solid: foot(0, -6, TILE, 6) });
  }

  for (let y = 558; y <= 750; y += TILE)
    for (const x of [216, 552])
      fence.push({ x, y, node: <FenceDown />, solid: foot(-3, -TILE, 6, TILE) });

  return [
    ...placed,
    ...fence,
    ...at(
      [
        [792, 566],
        [826, 578],
        [860, 566],
        [894, 578],
        [928, 566],
        [962, 578],
      ],
      () => ({ node: <Sunflower /> }),
    ),
    ...at(
      [
        [1034, 770],
        [1012, 812],
        [1478, 716],
        [1404, 936],
        [1096, 906],
        [1196, 690],
      ],
      () => ({ node: <Reeds /> }),
    ),
    {
      x: 408,
      y: 336,
      node: <Cottage />,
      solid: foot(-114, -84, 228, 84),
      lights: [
        [-72, -57, 20],
        [72, -57, 20],
      ],
    },
    { x: 1464, y: 288, node: <Windmill />, solid: foot(-42, -34, 84, 34), lights: [[0, -90, 14]] },
    { x: 792, y: 270, node: <Well />, solid: foot(-27, -22, 54, 26) },
    { x: 300, y: 357, node: <Mailbox />, solid: POST },
    { x: 567, y: 351, node: <ShippingBin />, solid: foot(-26, -18, 52, 20) },
    { x: 180, y: 651, node: <Scarecrow />, solid: POST },
    { x: 888, y: 492, node: <Bench />, solid: foot(-33, -12, 66, 14) },
    { x: 1149, y: 474, node: <Sign text="POND" />, solid: POST },
    { x: 759, y: 930, node: <Sign text="SOUTH" />, solid: POST },
    ...at(
      [
        [1341, 567],
        [1389, 585],
        [1365, 549],
      ],
      () => ({ node: <HayBale />, solid: foot(-24, -16, 48, 18) }),
    ),
    ...at(
      [
        [600, 378],
        [984, 378],
        [1380, 378],
        [747, 600],
      ],
      () => ({ node: <Lamp />, solid: POST, lights: [[0, -66, 30]] }),
    ),
    tree(190, 304, "blossom"),
    tree(646, 262, "blossom"),
    tree(800, 716, "apple"),
    tree(900, 900, "apple"),
    tree(560, 140, "oak"),
    tree(250, 180, "oak"),
    tree(1000, 200, "oak"),
    tree(1090, 150, "pine"),
    tree(1380, 150, "pine"),
    tree(1560, 440, "oak"),
    tree(420, 920, "oak"),
    tree(540, 1000, "pine"),
    tree(1130, 1040, "oak"),
    tree(1500, 900, "blossom"),
    ...at(
      [
        [620, 474],
        [1044, 300],
        [470, 830],
        [1506, 760],
      ],
      () => ({ node: <Bush />, solid: LOW }),
    ),
    ...at(
      [
        [1568, 620],
        [120, 486],
        [900, 1060],
      ],
      () => ({ node: <Bush berries />, solid: LOW }),
    ),
    ...at(
      [
        [1164, 640],
        [1330, 1010],
        [690, 980],
        [96, 800],
      ],
      () => ({ node: <Rock />, solid: LOW }),
    ),
    ...at(
      [
        [968, 560],
        [300, 900],
      ],
      () => ({ node: <Stump />, solid: LOW }),
    ),
  ];
};

const butterfly = (color: Hex): readonly [SvgNode, SvgNode] => [
  <Pixels
    of={canvas(7, 5)
      .box(0, 0, 3, 3, color)
      .box(4, 0, 3, 3, color)
      .dot(1, 3, color)
      .dot(5, 3, color)
      .box(3, 0, 1, 4, "#3a2a26")}
    anchor={[3, 2]}
  />,
  <Pixels
    of={canvas(7, 5).box(2, 0, 1, 3, color).box(4, 0, 1, 3, color).box(3, 0, 1, 4, "#3a2a26")}
    anchor={[3, 2]}
  />,
];

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

  const [open, shut] = butterfly(color);

  return (
    <g animation={flight}>
      <Flipbook
        cells={[
          [open, 0.12],
          [shut, 0.12],
        ]}
      />
    </g>
  );
};

const CLOUD = def.symbol(
  { style: "overflow:visible" },
  <Pixels
    of={canvas(180, 80)
      .oval(90, 40, 88, 36, "rgba(39,64,96,0.1)")
      .oval(70, 36, 50, 22, "rgba(39,64,96,0.07)")}
    anchor={[90, 40]}
  />,
);

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
    ].map(([start = 0, y = 0, lap = 80]) => (
      <Clip at={start}>
        <g transform={`translate(0 ${y})`}>
          <use
            href={CLOUD}
            animation={motion({ x: -330 })
              .to({ x: WORLD.width + 330 }, span(0, lap), ease.linear)
              .loop(lap)}
          />
        </g>
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
      desc: "A valley farm in pixels: a cottage, a fenced plot, a stream that runs into a pond, and a windmill past the bridge.",
      prefix: "world-",
      reducedMotion: false,
    },
    <>
      <g data-layer="ground">
        <rect width={WORLD.width} height={WORLD.height} fill={GRASS} />
        <Pixels of={ground()} />
        <Glints />
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
    grid: PX,
    solids,
    soil: squares("s"),
    places: {
      spawn: { x: 408, y: 405 },
      door: { x: 408, y: 340 },
      bin: { x: 567, y: 351 },
      well: { x: 792, y: 270 },
      mill: { x: 1464, y: 292 },
      dock: { x: 1040, y: 792 },
      pen: { x: 1400, y: 660 },
    },
  };
};
