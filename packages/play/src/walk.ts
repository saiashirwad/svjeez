import type { Point } from "svjeez";

/** A box on the ground, in world px. */
export interface Area {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Where walking is allowed: inside `bounds` and outside every solid. */
export interface Terrain {
  readonly bounds: Area;
  readonly solids: readonly Area[];
}

/** The ground a walker's feet cover, about its position. */
const FEET = { left: 9, right: 9, up: 7, down: 2 } as const;

const blocked = ({ x, y }: Point, { bounds, solids }: Terrain): boolean =>
  x - FEET.left < bounds.x ||
  x + FEET.right > bounds.x + bounds.width ||
  y - FEET.up < bounds.y ||
  y + FEET.down > bounds.y + bounds.height ||
  solids.some(
    (solid) =>
      x + FEET.right > solid.x &&
      x - FEET.left < solid.x + solid.width &&
      y + FEET.down > solid.y &&
      y - FEET.up < solid.y + solid.height,
  );

/** Walk from a point by a step, sliding along whatever is in the way. The result is `from` itself when nothing gives. */
export const walk = (from: Point, by: Point, terrain: Terrain): Point => {
  const across = { x: from.x + by.x, y: from.y };
  const afterX = blocked(across, terrain) ? from : across;
  const down = { x: afterX.x, y: afterX.y + by.y };

  return blocked(down, terrain) ? afterX : down;
};

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** True when a point is in an area. The left and top edges are in, the right and bottom are out. */
export const within = ({ x, y, width, height }: Area, at: Point): boolean =>
  at.x >= x && at.x < x + width && at.y >= y && at.y < y + height;

/** A seeded number from 0 up to 1, and the seed for the next one. Pure, so a model can carry its own luck. */
export const roll = (seed: number): readonly [value: number, next: number] => {
  const next = (seed + 0x6d2b79f5) | 0;
  const mixed = Math.imul(next ^ (next >>> 15), 1 | next);
  const again = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;

  return [((again ^ (again >>> 14)) >>> 0) / 4294967296, next];
};
