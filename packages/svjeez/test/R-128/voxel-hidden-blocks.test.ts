import { describe, expect, test } from "bun:test";
import { motion } from "svjeez";
import { voxel, type Vec3, type VoxelBlock } from "svjeez/voxel";
import { build, cellAt, green, place, uses } from "../helpers/voxel";

describe("voxel.scene", () => {
  describe("a block behind its three nearer neighbors", () => {
    const hidden = place([0, 0, 0]);

    const cover = (extra: Partial<VoxelBlock> = {}) =>
      (
        [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ] as const
      ).map((at) => place(at, { skin: green, ...extra }));

    const count = (covers: readonly VoxelBlock[]) => uses(build([hidden, ...covers])).length;

    test("is absent", () => expect(count(cover())).toBe(3));

    test.each([
      ["an animation", { animation: motion({ y: -5 }).to({ y: 0 }, 1) }],
      ["a transparent skin", { skin: voxel.texture({ x: "#00ff00", ".": null }, "x.") }],
      ["a later start", { from: 1 }],
    ] as const)("is present when a neighbor has %s", (_, extra) => {
      expect(count([cover(extra)[0]!, ...cover().slice(1)])).toBe(4);
    });

    test("is present when a neighbor lives a shorter time", () => {
      expect(uses(build([place([0, 0, 0], { to: 8 }), ...cover({ to: 5 })])).length).toBe(4);
    });

    test("is absent when a neighbor outlives it", () => {
      expect(
        uses(build([place([0, 0, 0], { from: 2, to: 5 }), ...cover({ from: 1, to: 7 })])).length,
      ).toBe(3);
    });
  });

  test("a solid 3x3x3 cube keeps only the blocks on its three nearer faces", () => {
    const cells = Array.from({ length: 27 }, (_, i): Vec3 => [
      i % 3,
      Math.floor(i / 3) % 3,
      Math.floor(i / 9),
    ]);

    const shown = uses(build(cells.map((at) => place(at)))).map(cellAt(cells));
    expect(shown.length).toBe(19);
    expect(shown.every((cell) => cell!.some((axis) => axis === 2))).toBe(true);
  });
});
