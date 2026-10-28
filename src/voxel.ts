import { groupBy } from "./layout/group";
import type { TagChannels } from "./channels";
import { def, type Ref } from "./defs";
import { el } from "./el";
import { motion, type Motion, type Seconds, type Stack } from "./motion";
import { camera, facingOf, type VoxelCamera, type Facing, type Vec3 } from "./space";
import type { SvgNode } from "./svg";
import { face, isOpaque, resolve, texture, type VoxelFace, type VoxelSkin, type VoxelTexture } from "./texture";

export interface VoxelBlock {
  /** Integer cell; the cube spans `at` to `at + 1`. */
  readonly at: Vec3;
  readonly skin: VoxelSkin;
  /** Visible from this time. Default 0. */
  readonly from?: Seconds;
  /** Gone from this time. Default never. */
  readonly to?: Seconds;
  /** Moves the block's `<use>` on the scene timeline. `from`/`to` own opacity, so this cannot animate it. */
  readonly animation?: Stack<Exclude<TagChannels<"use">, "opacity">>;
}

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

const check = ({ at, from = 0, to = Infinity }: VoxelBlock): void => {
  if (!at.every(Number.isInteger)) throw new Error(`voxel.scene() needs blocks on whole cells, got [${at.join(", ")}].`);
  if (!(from >= 0 && from < to)) throw new Error(`voxel.scene() needs 0 <= from < to, got from ${from} to ${to} on the block at [${at.join(", ")}].`);
};

const FACES = Object.keys(SIDES) as VoxelFace[];

export type { VoxelCamera, VoxelCameraOptions, Vec3 } from "./space";
export type { VoxelFace, VoxelPalette, VoxelSkin, VoxelTexture } from "./texture";

const scene = ({ camera: view, blocks }: VoxelScene): SvgNode => {
  blocks.forEach(check);
  const facing = facingOf(view);
  const [fx, , fz] = facing;
  const faces = visibleFaces(facing);
  const cells = groupBy(blocks, (block) => cellKey(block.at));

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
    (cover.from ?? 0) <= (block.from ?? 0) &&
    (cover.to ?? Infinity) >= (block.to ?? Infinity);

  const buried = (block: VoxelBlock): boolean => {
    const [x, y, z] = block.at;
    const near: Vec3[] = [[x, y + 1, z], ...(fx === 0 ? [] : [[x + fx, y, z] as const]), ...(fz === 0 ? [] : [[x, y, z + fz] as const])];
    return block.animation === undefined && near.every((cell) => cells.get(cellKey(cell))?.some((cover) => covers(cover, block)));
  };

  const textureIds = new Map<VoxelTexture, number>();
  const idOf = (tex: VoxelTexture): number => textureIds.get(tex) ?? (textureIds.set(tex, textureIds.size), textureIds.size - 1);
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
        return face(tex, shade, view.project(origin), view.project(u), view.project(v), BLEED / view.unit);
      }),
    );
    symbols.set(key, symbol);
    return symbol;
  };

  const depth = ({ at }: VoxelBlock): number => fx * at[0] + facing[1] * at[1] + fz * at[2];
  const visible = blocks
    .filter((block) => !buried(block))
    .map((block) => ({ block, depth: depth(block) }))
    .sort((a, b) => a.depth - b.depth)
    .map(({ block }) => block);

  return el.g(
    {},
    visible.map((block) => {
      const { x, y } = view.project(block.at);
      return el.use({ href: symbolOf(block.skin), x, y, animation: [lifetime(block.from ?? 0, block.to ?? Infinity), block.animation].flat() });
    }),
  );
};

export const voxel = { camera, texture, scene } as const;
