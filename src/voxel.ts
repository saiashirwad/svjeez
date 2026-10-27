import { groupBy } from "./layout/group";
import type { TagChannels } from "./channels";
import { def, type Ref } from "./defs";
import { el } from "./el";
import { motion, type Motion, type Seconds, type Stack } from "./motion";
import { camera, facingOf, type Camera, type Facing, type Vec3 } from "./space";
import type { SvgNode } from "./svg";
import { face, idOf, isOpaque, resolve, texture, type Face, type Skin } from "./texture";

export interface Block {
  /** Integer cell; the cube spans `at` to `at + 1`. */
  readonly at: Vec3;
  readonly skin: Skin;
  /** Visible from this time. Default 0. */
  readonly from?: Seconds;
  /** Gone from this time. Default never. */
  readonly until?: Seconds;
  /** Moves the block's `<use>` on the scene timeline. `from`/`until` own opacity, so this cannot animate it. */
  readonly animation?: Stack<Exclude<TagChannels<"use">, "opacity">>;
}

export interface Scene {
  readonly camera: Camera;
  /** Blocks on the same cell draw in the order given, so an overlay is a second block on the cell. */
  readonly blocks: readonly Block[];
}

interface Side {
  readonly shade: number;
  readonly origin: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
}

const SIDES: Readonly<Record<Face, Side>> = {
  top: { shade: 1, origin: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  south: { shade: 0.8, origin: [0, 1, 1], u: [1, 0, 0], v: [0, -1, 0] },
  north: { shade: 0.8, origin: [1, 1, 0], u: [-1, 0, 0], v: [0, -1, 0] },
  east: { shade: 0.6, origin: [1, 1, 1], u: [0, 0, -1], v: [0, -1, 0] },
  west: { shade: 0.6, origin: [0, 1, 0], u: [0, 0, 1], v: [0, -1, 0] },
};

/** Screen pixels a face grows by on every side, so abutting faces leave no antialiased seam. */
const BLEED = 0.4;

const visibleFaces = ([x, , z]: Facing): readonly Face[] => {
  const sides: Face[] = [];
  if (x !== 0) sides.push(x > 0 ? "east" : "west");
  if (z !== 0) sides.push(z > 0 ? "south" : "north");
  return [...sides, "top"];
};

const cellKey = ([x, y, z]: Vec3): string => `${x},${y},${z}`;

const lifetime = (from: Seconds, until: Seconds): Motion<"opacity"> | undefined => {
  if (from === 0 && until === Infinity) return;
  const arrive = from > 0 ? motion({ opacity: 0 }).at(from).set({ opacity: 1 }) : motion();
  return until === Infinity ? arrive : arrive.at(until).set({ opacity: 0 });
};

const check = ({ at, from = 0, until = Infinity }: Block): void => {
  if (!at.every(Number.isInteger)) throw new Error(`A block sits on a whole cell, got [${at.join(", ")}].`);
  if (!(from >= 0 && from < until)) throw new Error(`A block at [${at.join(", ")}] lives from ${from} until ${until}; it needs 0 <= from < until.`);
};

const FACES = Object.keys(SIDES) as Face[];

export type { Camera, Vec3 } from "./space";
export type { Face, Skin, Texture } from "./texture";

const scene = ({ camera: view, blocks }: Scene): SvgNode => {
  blocks.forEach(check);
  const facing = facingOf(view);
  const [fx, , fz] = facing;
  const faces = visibleFaces(facing);
  const cells = groupBy(blocks, (block) => cellKey(block.at));

  const opaque = new Map<Skin, boolean>();
  const solid = (skin: Skin): boolean => {
    const known = opaque.get(skin);
    if (known !== undefined) return known;
    const all = FACES.every((side) => isOpaque(resolve(skin, side)));
    opaque.set(skin, all);
    return all;
  };

  const covers = (cover: Block, block: Block): boolean =>
    cover.animation === undefined &&
    solid(cover.skin) &&
    (cover.from ?? 0) <= (block.from ?? 0) &&
    (cover.until ?? Infinity) >= (block.until ?? Infinity);

  const buried = (block: Block): boolean => {
    const [x, y, z] = block.at;
    const near: Vec3[] = [[x, y + 1, z], ...(fx === 0 ? [] : [[x + fx, y, z] as const]), ...(fz === 0 ? [] : [[x, y, z + fz] as const])];
    return block.animation === undefined && near.every((cell) => cells.get(cellKey(cell))?.some((cover) => covers(cover, block)));
  };

  const symbols = new Map<string, Ref<"symbol">>();
  const symbolOf = (skin: Skin): Ref<"symbol"> => {
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

  const depth = ({ at }: Block): number => fx * at[0] + facing[1] * at[1] + fz * at[2];
  const visible = blocks
    .filter((block) => !buried(block))
    .map((block) => ({ block, depth: depth(block) }))
    .sort((a, b) => a.depth - b.depth)
    .map(({ block }) => block);

  return el.g(
    {},
    visible.map((block) => {
      const { x, y } = view.project(block.at);
      return el.use({ href: symbolOf(block.skin), x, y, animation: [lifetime(block.from ?? 0, block.until ?? Infinity), block.animation].flat() });
    }),
  );
};

export const voxel = { camera, texture, scene } as const;
