import { ease, motion, type Motion, type Seconds } from "svjeez";
import type { Vec3, VoxelBlock } from "svjeez/voxel";
import { BEAT, GRID, random, tenth } from "./kit";
import { COLUMNS, LAKE, PLOT, columnOf, type Column } from "./terrain";
import { SKIN } from "./textures";

const FAR = 2 * (GRID - 1);

const nearness = ({ x, z }: { readonly x: number; readonly z: number }): number => (x + z) / FAR;

const jitter = (x: number, z: number): number => 0.1 * Math.floor(random(x * 97 + z)() * 3);

const risesAt = (column: Column): number => tenth(BEAT.rise + (1 - nearness(column)) * (BEAT.risen - BEAT.rise) + jitter(column.x, column.z));
const leavesAt = (column: Column): number => tenth(BEAT.void + nearness(column) * (BEAT.voided - BEAT.void));
const snowsAt = (column: Column): number => tenth(BEAT.snow + 1 + (1 - nearness(column)) * (BEAT.snowed - BEAT.snow - 1) + jitter(column.x, column.z));

const DROP = 18;
const SINK = 90;

const life = (from: Seconds, until: Seconds): Motion<"y"> =>
  motion({ y: -DROP }).at(from).to({ y: 0 }, 0.35, ease.pop).at(until - 0.5).to({ y: SINK }, 0.5, ease.in);

const sinks = (until: Seconds): Motion<"y"> => motion({ y: 0 }).at(until - 0.5).to({ y: SINK }, 0.5, ease.in);

const skinAt = (column: Column, depth: number) => {
  if (depth === 0) return column.kind === "grass" ? SKIN.grass : column.kind === "stone" ? SKIN.stone : SKIN.sand;
  if (column.kind === "stone") return SKIN.stone;
  return depth <= 2 ? SKIN.dirt : SKIN.stone;
};

const terrain = (column: Column): VoxelBlock[] => {
  const { x, z, top, depth } = column;
  const [from, until] = [risesAt(column), leavesAt(column)];
  return Array.from({ length: top + depth }, (_, i): VoxelBlock => {
    const y = top - 1 - i;
    const shallow = i <= 1;
    const landed = tenth(from + 0.3);
    return i === 0
      ? { at: [x, y, z], skin: skinAt(column, i), from: landed, to: snowy(column) ? snowsAt(column) : until, animation: life(landed, until) }
      : { at: [x, y, z], skin: skinAt(column, i), from, to: until, animation: shallow ? sinks(until) : undefined };
  });
};

const snowy = ({ kind }: Column): boolean => kind === "grass" || kind === "stone";

const water = ({ x, z, top }: Column): VoxelBlock[] => {
  const shore = Math.hypot(x - LAKE.x, z - LAKE.z);
  const [filled, frozen] = [tenth(BEAT.lake + shore * 0.35), tenth(BEAT.freeze + shore * 0.2)];
  const until = leavesAt(columnOf(x, z)!);
  return [
    { at: [x, top, z], skin: SKIN.water, from: filled, to: frozen, animation: motion({ y: -6 }).at(filled).to({ y: 0 }, 0.6) },
    { at: [x, top, z], skin: SKIN.ice, from: frozen, to: until, animation: sinks(until) },
  ];
};

const snow = (column: Column): VoxelBlock[] =>
  snowy(column)
    ? [{ at: [column.x, column.top - 1, column.z], skin: SKIN.snow, from: snowsAt(column), to: leavesAt(column), animation: sinks(leavesAt(column)) }]
    : [];

interface Part {
  readonly at: Vec3;
  readonly skin: VoxelBlock["skin"];
}

const built = (parts: readonly Part[], start: Seconds, step: Seconds, gone: (at: Vec3) => Seconds): VoxelBlock[] =>
  parts.map(({ at, skin }, i): VoxelBlock => {
    const [from, until] = [tenth(start + i * step), gone(at)];
    return { at, skin, from, to: until, animation: life(from, until) };
  });

const nearPlot = ({ x, z }: Column, margin: number): boolean =>
  x >= PLOT.x - margin && x < PLOT.x + PLOT.size + margin && z >= PLOT.z - margin && z < PLOT.z + PLOT.size + margin;

const shuffled = <T,>(items: readonly T[], seed: number): T[] => {
  const pick = random(seed);
  return items.map((item) => [pick(), item] as const).sort(([a], [b]) => a - b).map(([, item]) => item);
};

const spots = (): readonly Column[] => {
  const taken: Column[] = [];
  const free = COLUMNS.filter(
    (column) =>
      column.kind === "grass" &&
      column.top === 3 &&
      !nearPlot(column, 1) &&
      Math.abs(column.x - column.z) >= 4 &&
      Math.hypot(column.x - LAKE.x, column.z - LAKE.z) > LAKE.radius + 2 &&
      [-1, 0, 1].every((dx) => [-1, 0, 1].every((dz) => columnOf(column.x + dx, column.z + dz))),
  );
  for (const column of shuffled(free, 5)) {
    if (taken.length < BEAT.trees.length && taken.every((other) => Math.hypot(other.x - column.x, other.z - column.z) >= 3.5)) taken.push(column);
  }
  return taken;
};

export const TREES = spots();

const range = (low: number, high: number): number[] => Array.from({ length: high - low + 1 }, (_, i) => low + i);

const LEAF_CELLS: readonly (readonly [number, number, number])[] = [
  ...[0, 1].flatMap((y) => range(-2, 2).flatMap((dx) => range(-2, 2).filter((dz) => !(Math.abs(dx) === 2 && Math.abs(dz) === 2)).map((dz) => [dx, y, dz] as const))),
  ...range(-1, 1).flatMap((dx) => range(-1, 1).map((dz) => [dx, 2, dz] as const)),
  ...range(-1, 1).flatMap((dx) => range(-1, 1).filter((dz) => Math.abs(dx) + Math.abs(dz) <= 1).map((dz) => [dx, 3, dz] as const)),
];

const CROWN_TOPS = LEAF_CELLS.filter(([dx, y, dz]) => !LEAF_CELLS.some(([ox, oy, oz]) => ox === dx && oz === dz && oy > y));

const fallsAt = (top: number, y: number): Seconds => tenth(BEAT.fall + (top + 7 - y) * 0.08);

const tree = ({ x, z, top }: Column, start: Seconds): VoxelBlock[] => {
  const goes = (y: number): Seconds => fallsAt(top, y);
  const trunk = built(range(0, 3).map((i): Part => ({ at: [x, top + i, z], skin: SKIN.log })), start + 0.8, 0.45, ([, y]) => goes(y));
  const canopyStart = start + 3;
  const crown = built(
    LEAF_CELLS.filter(([dx, y, dz]) => !(dx === 0 && dz === 0 && y === 0)).map(([dx, y, dz]): Part => ({ at: [x + dx, top + 3 + y, z + dz], skin: SKIN.leaves })),
    canopyStart,
    0.04,
    ([, y]) => goes(y),
  );
  return [...trunk, ...crown];
};

const crownTops = ({ x, z, top }: Column): VoxelBlock[] =>
  CROWN_TOPS.map(([dx, y, dz]): VoxelBlock => {
    const at: Vec3 = [x + dx, top + 3 + y, z + dz];
    const until = fallsAt(top, at[1]);
    return { at, skin: SKIN.snowCap, from: tenth(BEAT.snow + 1.5 + (1 - nearness({ x: at[0], z: at[2] })) * 3), to: until, animation: sinks(until) };
  });

const flowers = (): VoxelBlock[] => {
  const free = COLUMNS.filter(
    (column) => column.kind === "grass" && column.top === 3 && !nearPlot(column, 1) && !TREES.some((t) => Math.hypot(t.x - column.x, t.z - column.z) < 2.5),
  );
  const chosen = shuffled(free, 23).slice(0, 9);
  const step = (BEAT.flowersEnd - BEAT.flowers) / chosen.length;
  return chosen.map(({ x, z, top }, i): VoxelBlock => {
    const [from, until] = [tenth(BEAT.flowers + i * step), tenth(BEAT.void + 0.2 * i)];
    return { at: [x, top, z], skin: i % 2 ? SKIN.flowerYellow : SKIN.flowerRed, from, to: until, animation: life(from, until) };
  });
};

const hutAt = (i: number, j: number, y: number): Vec3 => [PLOT.x + i, y, PLOT.z + j];

const EDGE = range(0, 4);
const ring = EDGE.flatMap((a) => EDGE.map((b) => [a, b] as const)).filter(([i, j]) => i === 0 || j === 0 || i === 4 || j === 4);
const corner = ([i, j]: readonly [number, number]) => (i === 0 || i === 4) && (j === 0 || j === 4);
const door = ([i, j]: readonly [number, number]) => i === 2 && j === 4;
const windows: readonly (readonly [number, number])[] = [[4, 2], [1, 4], [3, 4]];
const window = ([i, j]: readonly [number, number]) => windows.some(([a, b]) => a === i && b === j);

const spiral = (cells: readonly (readonly [number, number])[]) => cells.toSorted(([a, b], [c, d]) => -(a + b) + (c + d) || a - c);

const hut = (): VoxelBlock[] => {
  const goes = (y: number): Seconds => tenth(BEAT.fall + (7 - y) * 0.1);
  const level = (y: number): Part[] =>
    spiral(ring)
      .filter((cell) => !door(cell) && !(window(cell) && y === PLOT.top + 1))
      .map((cell): Part => ({ at: hutAt(cell[0], cell[1], y), skin: corner(cell) ? SKIN.log : SKIN.planks }));
  const frames: Part[] = windows.map(([i, j]): Part => ({ at: hutAt(i, j, PLOT.top + 1), skin: SKIN.glass }));
  const roof = (low: number, high: number, y: number): Part[] => range(low, high).flatMap((i) => range(low, high).map((j): Part => ({ at: hutAt(i, j, y), skin: SKIN.roof })));
  const parts: Part[] = [...level(PLOT.top), ...level(PLOT.top + 1), ...frames, ...roof(0, 4, PLOT.top + 2), ...roof(1, 3, PLOT.top + 3), { at: hutAt(2, 2, PLOT.top + 4), skin: SKIN.roof }];
  return built(parts, BEAT.hut, (BEAT.hutEnd - BEAT.hut) / parts.length, ([, y]) => goes(y));
};

const POST = columnOf(PLOT.x + 5, PLOT.z + 4)!;

const lantern = (): VoxelBlock[] => {
  const [from, until] = [tenth(BEAT.hutEnd - 0.4), goes()];
  return [
    { at: [POST.x, POST.top, POST.z], skin: SKIN.log, from, to: until, animation: life(from, until) },
    { at: [POST.x, POST.top + 1, POST.z], skin: SKIN.lampOff, from: tenth(from + 0.3), to: until, animation: life(tenth(from + 0.3), until) },
  ];
};

const goes = (): Seconds => tenth(BEAT.fall + 0.4);

const lit = (): VoxelBlock[] => {
  const lamps: readonly Vec3[] = [...windows.map(([i, j]) => hutAt(i, j, PLOT.top + 1)), [POST.x, POST.top + 1, POST.z]];
  return lamps.map((at): VoxelBlock => ({ at, skin: SKIN.lampOn, from: BEAT.lights, to: BEAT.lightsOut }));
};

export const LIGHTS: readonly Vec3[] = [
  ...windows.map(([i, j]): Vec3 => (i === 4 ? [PLOT.x + 5, PLOT.top + 1.5, PLOT.z + j + 0.5] : [PLOT.x + i + 0.5, PLOT.top + 1.5, PLOT.z + 5])),
  [POST.x + 1, POST.top + 1.5, POST.z + 0.5],
];

export const island = (): VoxelBlock[] => [
  ...COLUMNS.flatMap(terrain),
  ...COLUMNS.filter((column) => column.kind === "lake").flatMap(water),
  ...TREES.flatMap((column, i) => tree(column, BEAT.trees[i]!)),
  ...flowers(),
  ...hut(),
  ...lantern(),
  ...COLUMNS.flatMap(snow),
  ...TREES.flatMap(crownTops),
  ...lit(),
];
