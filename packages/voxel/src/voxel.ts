import {
  def,
  groupBy,
  motion,
  type Motion,
  type Ref,
  type Seconds,
  type Stack,
  type SvgNode,
  type TagChannels,
  type When,
} from "svjeez";
import { el } from "svjeez/internal";
import { camera, facingOf, type VoxelCamera, type Facing, type Vec3 } from "./space.ts";
import {
  face,
  isOpaque,
  resolve,
  texture,
  type VoxelFace,
  type VoxelSkin,
  type VoxelTexture,
} from "./texture.ts";

interface BlockBase {
  readonly skin: VoxelSkin;
  /** When the block shows: from `at`, for `over` seconds, or to the end without `over`. Default always. */
  readonly show?: When;
  /** @deprecated use `show: { at }` */
  readonly from?: Seconds;
  /** @deprecated use `show: { at, over }` */
  readonly to?: Seconds;
  /** Moves the block's `<use>` on the scene timeline. `show` owns opacity, so this cannot animate it. */
  readonly animation?: Stack<Exclude<TagChannels<"use">, "opacity">>;
}

export type VoxelBlock = BlockBase &
  (
    | {
        /** Integer cell; the cube spans `cell` to `cell + 1`. */
        readonly cell: Vec3;
        readonly at?: undefined;
      }
    | {
        /** @deprecated use `cell` */
        readonly at: Vec3;
        readonly cell?: undefined;
      }
  );

const cellOf = (block: VoxelBlock): Vec3 => block.cell ?? block.at;

export interface VoxelScene {
  readonly camera: VoxelCamera;
  /** Blocks on the same cell draw in the order given, so an overlay is a second block on the cell. */
  readonly blocks: readonly VoxelBlock[];
}

interface Side {
  readonly shade: number;
  readonly origin: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
}

const SIDES: Readonly<Record<VoxelFace, Side>> = {
  top: { shade: 1, origin: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  south: { shade: 0.8, origin: [0, 1, 1], u: [1, 0, 0], v: [0, -1, 0] },
  north: { shade: 0.8, origin: [1, 1, 0], u: [-1, 0, 0], v: [0, -1, 0] },
  east: { shade: 0.6, origin: [1, 1, 1], u: [0, 0, -1], v: [0, -1, 0] },
  west: { shade: 0.6, origin: [0, 1, 0], u: [0, 0, 1], v: [0, -1, 0] },
};

/** Screen pixels a face grows by on every side, so abutting faces leave no antialiased seam. */
const BLEED = 0.4;

const visibleFaces = ([x, , z]: Facing): readonly VoxelFace[] => {
  const sides: VoxelFace[] = [];

  if (x !== 0) sides.push(x > 0 ? "east" : "west");

  if (z !== 0) sides.push(z > 0 ? "south" : "north");

  return [...sides, "top"];
};

const cellKey = ([x, y, z]: Vec3): string => `${x},${y},${z}`;

const lifetime = (from: Seconds, to: Seconds): Motion<"opacity"> | undefined => {
  if (from === 0 && to === Infinity) return;
  const arrive = from > 0 ? motion({ opacity: 0 }).at(from).set({ opacity: 1 }) : motion();

  return to === Infinity ? arrive : arrive.at(to).set({ opacity: 0 });
};

/** When a block shows, as the time it appears and the time it goes. */
const lifeOf = ({ show, from = 0, to = Infinity }: BlockBase): readonly [Seconds, Seconds] =>
  show ? [show.at, show.over === undefined ? Infinity : show.at + show.over] : [from, to];

const check = (block: VoxelBlock): void => {
  const [from, to] = lifeOf(block);
  const cell = cellOf(block);

  if (!cell.every(Number.isInteger))
    throw new Error(`voxel.scene() needs blocks on whole cells, got [${cell.join(", ")}].`);

  if (block.show && (block.from !== undefined || block.to !== undefined))
    throw new Error(
      `voxel.scene() takes show or from and to, not both, on the block at [${cell.join(", ")}].`,
    );

  if (!(from >= 0 && from < to))
    throw new Error(
      block.show
        ? `voxel.scene() needs a show that starts at 0 or later and lasts, got at ${from} over ${to - from} on the block at [${cell.join(", ")}].`
        : `voxel.scene() needs 0 <= from < to, got from ${from} to ${to} on the block at [${cell.join(", ")}].`,
    );
};

// SAFETY: SIDES is typed Record<VoxelFace, Side>, so its keys are exactly the faces.
const FACES = Object.keys(SIDES) as VoxelFace[];

export type { VoxelCamera, VoxelCameraOptions, Vec3 } from "./space.ts";

export type { VoxelFace, VoxelPalette, VoxelSkin, VoxelTexture } from "./texture.ts";

const scene = ({ camera: view, blocks }: VoxelScene): SvgNode => {
  blocks.forEach(check);
  const facing = facingOf(view);
  const [fx, , fz] = facing;
  const faces = visibleFaces(facing);
  const cells = groupBy(blocks, (block) => cellKey(cellOf(block)));

  const opaque = new Map<VoxelSkin, boolean>();

  const solid = (skin: VoxelSkin): boolean => {
    const known = opaque.get(skin);

    if (known !== undefined) return known;
    const all = FACES.every((side) => isOpaque(resolve(skin, side)));
    opaque.set(skin, all);

    return all;
  };

  const covers = (cover: VoxelBlock, block: VoxelBlock): boolean =>
    cover.animation === undefined &&
    solid(cover.skin) &&
    lifeOf(cover)[0] <= lifeOf(block)[0] &&
    lifeOf(cover)[1] >= lifeOf(block)[1];

  const buried = (block: VoxelBlock): boolean => {
    const [x, y, z] = cellOf(block);

    const near: Vec3[] = [
      [x, y + 1, z],
      ...(fx === 0 ? [] : [[x + fx, y, z] as const]),
      ...(fz === 0 ? [] : [[x, y, z + fz] as const]),
    ];

    return (
      block.animation === undefined &&
      near.every((cell) => cells.get(cellKey(cell))?.some((cover) => covers(cover, block)))
    );
  };

  const textureIds = new Map<VoxelTexture, number>();

  const idOf = (tex: VoxelTexture): number =>
    textureIds.get(tex) ?? (textureIds.set(tex, textureIds.size), textureIds.size - 1);

  const symbols = new Map<string, Ref<"symbol">>();

  const symbolOf = (skin: VoxelSkin): Ref<"symbol"> => {
    const sides = faces.map((side) => [side, resolve(skin, side)] as const);
    const key = sides.map(([, tex]) => idOf(tex)).join();
    const known = symbols.get(key);

    if (known) return known;

    const symbol = def.symbol(
      { style: "overflow:visible" },
      sides.map(([side, tex]) => {
        const { shade, origin, u, v } = SIDES[side];

        return face(
          tex,
          shade,
          view.project(origin),
          view.project(u),
          view.project(v),
          BLEED / view.unit,
        );
      }),
    );

    symbols.set(key, symbol);

    return symbol;
  };

  const depth = (block: VoxelBlock): number => {
    const cell = cellOf(block);

    return fx * cell[0] + facing[1] * cell[1] + fz * cell[2];
  };

  const visible = blocks
    .filter((block) => !buried(block))
    .map((block) => ({ block, depth: depth(block) }))
    .sort((a, b) => a.depth - b.depth)
    .map(({ block }) => block);

  return el.g(
    {},
    visible.map((block) => {
      const { x, y } = view.project(cellOf(block));

      return el.use({
        href: symbolOf(block.skin),
        x,
        y,
        animation: [lifetime(...lifeOf(block)), block.animation].flat(),
      });
    }),
  );
};

export const voxel = { camera, texture, scene } as const;
