import { describe, expect, test } from "bun:test";
import type { Vec3, VoxelBlock } from "svjeez/voxel";
import { build, camera, cellAt, green, place, red, topColor, uses } from "../helpers/voxel";

describe("voxel.scene", () => {
  test("blocks come out back to front however they are given", () => {
    const cells: Vec3[] = [
      [1, 1, 0],
      [0, 0, 0],
      [2, 0, 2],
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 3],
    ];

    const depth = (cell: Vec3) => cell[0] + cell[1] + cell[2];
    const order = uses(build(cells.map((at) => place(at)))).map(cellAt(cells));
    expect(order.map((cell) => depth(cell!))).toEqual(cells.map(depth).sort((a, b) => a - b));
  });

  test("blocks sharing a cell keep the order given", () => {
    const colors = (blocks: readonly VoxelBlock[]) => {
      const svg = build(blocks);

      return uses(svg).map((use) => topColor(svg, use.href));
    };

    expect(colors([place([0, 0, 0], { skin: red }), place([0, 0, 0], { skin: green })])).toEqual([
      "#ff0000",
      "#00ff00",
    ]);
    expect(colors([place([0, 0, 0], { skin: green }), place([0, 0, 0], { skin: red })])).toEqual([
      "#00ff00",
      "#ff0000",
    ]);
  });
});

describe("voxel.camera", () => {
  test("projects linearly, so a path projects to the path of its projection", () => {
    const [a, b] = [camera.project([1, 2, 3]), camera.project([4, 0, 1])];
    const mid = camera.project([2.5, 1, 2]);
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2);
    expect(mid.y).toBeCloseTo((a.y + b.y) / 2);
  });

  test("a block's height is its vertical edge", () => {
    const { y } = camera.project([0, 1, 0]);
    expect(y).toBeCloseTo(-10 * Math.cos(Math.PI / 6));
  });
});
